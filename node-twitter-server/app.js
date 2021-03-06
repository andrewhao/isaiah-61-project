require.paths.unshift('../../node_libraries');
var sys = require('sys'),
    http = require('http'),
    express = require('express'),
    io = require('socket.io'),
    util = require('util'),
    net = require('net'),
    EE = require('events').EventEmitter,
    twitter = require('twitter');

/**
 * Create a twitter stream to the Streaming API
 */
var twit = new twitter({
    consumer_key: 'LsX6TUMSfwqqUaxfw4Kcsw',
    consumer_secret: 'O9nD1g0Cuqngl5N1Ij1CoY0G9Nm96ZeOGr2CfQKSXQ',
    access_token_key: '253928382-gEBAuXYl4jtezGUG7GbPhdxm0b0akm6raI2spd9Y',
    access_token_secret: 'chLg4V2aTw6saRuoEmnLNFirr1Cq0g0rmQOcqy8Tw'
});

/**
 * AggregateQueue
 *
 * A wrapper over multiple queues. Queues are drained in a 
 * random manner.
 */
function AggregateQueue(queueList) {
    EE.call(this);
    this.queueList = queueList;
}
util.inherits(AggregateQueue, EE);

// Shifts the queue, sets up the next one to be shifted next. 
// TODO: randomize
AggregateQueue.prototype.shift = function() {
    this.emit('shift');
    var idx = Math.floor(Math.random() * this.queueList.length);
    var data = this.queueList[idx].shift();
    return data;
}

/**
 * Fills the queue with enough search terms.
 */
AggregateQueue.prototype.fill = function() {
    // Primes the queue with a proper initial set.
    for (var i in this.queueList) {
        this.queueList[i].checkLength();
    }
}

/**
 * TweetQueue
 *
 * A simple queue, modified to be evented and emit a "low"
 * event when under a threshold of n items.
 */
function TweetQueue() {
    EE.call(this);
    this.queue = [];
    // This queue shouldn't be pushed onto because another
    // fill request is in session.
    this.lock = false;
    // The # of queue items the queue contains
    // or less where a 'low' event will be emitted by
    // the queue.
    this.lowThreshold = 10; 
}
util.inherits(TweetQueue, EE);

/**
 * Shifts and returns the item at the beginning of the queue.
 */
TweetQueue.prototype.shift = function() {
    this.emit('shift');
    this.checkLength();
    return this.queue.shift();
}

/**
 * Pushes an item to the back of the queue.
 */
TweetQueue.prototype.push = function(obj) {
    this.emit('push');
    return this.queue.push(obj);
}

/**
 * Checks the status of the queue and emits a
 * 'low' event
 */
TweetQueue.prototype.checkLength = function() {
    if (this.queue.length <= this.lowThreshold) {
        this.emit('low', this.queue.length);
    }
}

/**
 * Setting up the AggregateQueue
 */
// References to specific queues.
var painQueue = new TweetQueue();
var griefQueue = new TweetQueue();
var injusticeQueue = new TweetQueue();
var oaklandQueue = new TweetQueue();

// I don't want to see these.
var blacklist = ['RT', 'bieb', 'justin', 'fuck', 'shit'];

var fullQueue = new AggregateQueue([painQueue, injusticeQueue, griefQueue, oaklandQueue]);

var queueSpec = {
    // "bind up the brokenhearted"
    'pain': {
        queue: painQueue,
        kw: ["sad", "depressed", "afraid", "trapped","lonely","grief","cry"],
        kw_req: "i feel",
    },
    // "day of vengeance of our God"
    'injustice': {
        queue: injusticeQueue,
        kw: ["injustice","justice","violence","assault","murder","slavery","corruption","mugged"],
        kw_req: "",
    },
    // "oil of gladness instead of mourning"
    'grief': {
        queue: griefQueue,
        kw: ["passed away","dead","death","decease","grief","RIP", "R.I.P.", "rest in peace"],
        kw_req: "",
    },
    // "oaks of righteousness"
    'oakland': {
        queue: oaklandQueue,
        kw: ["oakland"],
        kw_req: "",
    },
};

// Set up listeners for each queue.
for (var qtype in queueSpec) {
    // Module pattern
    // http://meshfields.de/event-listeners-for-loop/
    // Binds the queue spec to the scope in the closure.
    (function(qtype) {
        
        var qd = queueSpec[qtype];
        qd.queue.on('low', function (queueLength) {
            
        // Not all keywords will take place in the search.
        // Weight their appearances in the search each time.
        // Each search term has a 1/3 probability of turning up.
        if (qtype != 'oakland') {
            temp_kw = qd.kw.filter(function(k) { return Math.random() < 0.4; });                
        }
        
        sys.puts('queue ' + qtype + ' is low! refilling...');
            /**
             * Do a twitter search
             */
            var numResults = 100
            twit.search(qd.kw_req + " (" + qd.kw.join(' OR ') + ")", {lang: 'en', rpp: numResults}, function(data) {
                
                // Choose a subset of results, randomly
                var chosens = [];
                for (var num_chosen = 0; num_chosen < 50; num_chosen++) {

                    // Choose a random idx that hasn't been chosen before
                    var i = Math.floor(Math.random()*numResults);
                    if (chosens.indexOf(i) == -1) {

                        var text = data.results[i].text;

                        // Filter out blacklisted elements
                        var blacklisted = false;
                        for (var b in blacklist) {
                            var w = blacklist[b];
                            if (text.toLowerCase().indexOf(w.toLowerCase()) != -1) {
                                blacklisted = true;
                                break;
                            }
                        }

                        if (!blacklisted) {
                            qd.queue.push({
                                tweet: data.results[i],
                                tweet_type: qtype
                            });
                        }

                        // Store a record that we've searched for this before.
                        chosens.push(i);
                    }
                }
            });
        });
    }) (qtype);
}

// Fill up the queues with starter data.
fullQueue.fill();
    
/**
 * Simple web server
 */
var server = express.createServer();

server.configure(function() {
    server.use(express.staticProvider(__dirname + '/public'));
});

/**
 * HTTP server
 */
server.get('/', function(req, res) {
    res.render('index.haml', {locals: {title: 'Instead of Ashes'}});
});
server.listen(8080);

/**
 * Socket interface to Arduino script.
 */
var arduino = net.createServer(function (stream) {
    
    // Set a reference to the arduino stream from the socket.
    boss.arduino_socket = stream;
    
    stream.setEncoding('utf8');
    stream.on('connect', function() {
        sys.puts('Connection detected from Arduino: ' + sys.inspect(stream, false));
    });
    
    stream.on('data', function(data) {
        sys.puts('Echoing data from arduino client: ' + sys.inspect(data));
        boss.sendMessage('arduino', data);
    });
    stream.on('end', function() {
        stream.end();
    })
});
arduino.listen(7000);

/**
 * Socket.io
 */
var websocket = io.listen(server); 
websocket.on('connection', function(client){    
    
    // Give the EventController a reference to client
    boss.web_socket = client;

    // Twitter live parse.
    twit.stream('statuses/filter', {follow: '253928382'}, function(stream) {
        stream.on('data', function (data) {
            sys.puts(sys.inspect(data));
            boss.web_socket.send({typ: 'reply', data: data});
        });
    });
    
    // Oops, we lost the client.
    client.on('disconnect', function(){
        sys.puts(sys.inspect('client disconnected.'))
    });
});

/** Mapping of queue type to pin output */
var queuePinMap = {
    'pain': 3,
    'injustice': 5,
    'grief': 6,
    'oakland': 9,
}

var pins = [3, 5, 6, 9];

/**
 * The brains of the whole operation
 *
 * This is responsible for setting up connections to web and arduino.
 */
function EventDriver() {
    EE.call(this);
    this.web_socket = null;
    this.arduino_socket = null;
    
    // Flag storing whether the first tweet has been pushed yet.
    // This helps us keep track of how to dispose of the first tweet.
    this.discardFirstTweet = false;

    // Stores return messages from external sources.
    // Currently of the format <source>:<message>.
    // Where source = 'web' | 'arduino'
    this.msg_queue = [];

    // Opens up the LED pulse queue.
    this.allow_led_pulse = false;
    
    // Buffers the LED drain by an offset because
    // they are offset on the Web UI.
    // Initialize with pin 13. Dummy throwaway.
    this.led_queue = [];
    
    this.current_tweet_id = null;
}
util.inherits(EventDriver, EE);

/**
 * Checks whether we're properly initialized.
 */
EventDriver.prototype.isReady = function() {
    return this.web_socket != null && 
           this.arduino_socket != null;
}

/**
 * Add a message to the message queue.
 *
 * @param {String} src
 *   'web' | 'arduino'
 * @param {String} msg
 *   Text string
 */
EventDriver.prototype.sendMessage = function(src, msg) {
    this.msg_queue.push(src + ':' + msg);
}

/**
 * Event loop.
 */
EventDriver.prototype.tick = function() {
    sys.puts('tick');
    
    // Drain the queue and grab the newest tweet to send.
    var data = fullQueue.shift();
    if (data) {
        
        // So here's the tricky part. We send the data to the Web browser and we
        // wait for a signal. Then we wait for the browser to tell us whether the tweet
        // is onscreen.
        this.web_socket.send({typ: 'search', data: data});
        
        var pin = queuePinMap[data.tweet_type];
        
        this.led_queue.push({ident: data.tweet.id_str, pin: pin});
        
        // FIXME. A rudimentary condition variable
        var waitingForSocketResponse = true;
        var driver = this;
        
        this.web_socket.on('message', function(msg) {
            
            var msgParts = msg.split(':');
            var clientType = msgParts[0];
            var clientMsg = msgParts[1];
            driver.current_tweet_id = msgParts[2];
            
            // The Web client has notified us that the first
            // tweet has fallen off the screen. This is a signal for us
            // to prepare to start pulsing the lights in preparation for
            // the first Web UI slide animation.
            if (!driver.allow_led_pulse && clientMsg == 'tweet_offscreen') {
                sys.puts('shift offscreen!');
                driver.allow_led_pulse = true;                    
                sys.puts('led queue before shift is: ' + sys.inspect(driver.led_queue))
            }
            
            waitingForSocketResponse = false;
        });

        // FIXME Is there some way to make sure the code above executes sequentially?
        // Wow. Spin wait? That's dumb. Callback?
        while(true) {
            if (waitingForSocketResponse) {
                break;
            } else {
                // do nothing                
            }
        }
        
        // If the LED buffer is open, begin shifting pulses.
        if (this.allow_led_pulse) {
            // Search for the right tweet
            var result = this.led_queue.filter(function(el) {
               return el.ident == driver.current_tweet_id;
            });
            var t = result[0];
            sys.puts('Sending signal to pin: ' + t.pin);
            this.arduino_socket.write(t.pin + '\0');
        }
    }
}

boss = new EventDriver();

setInterval(function() {
    if (boss.isReady()) {
        boss.tick();
    } else {
        sys.puts('Still waiting for node + arduino initialization.');
    }
}, 10000);
