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
 * (random?) and fair manner.
 */
function AggregateQueue(queueList) {
    EE.call(this);
    this.queueList = queueList;
    this.currentIdx = 0;
}
util.inherits(AggregateQueue, EE);

// Shifts the queue, sets up the next one to be shifted next. 
// TODO: randomize
AggregateQueue.prototype.shift = function() {
    this.emit('shift');
    var data = this.queueList[this.currentIdx].shift();
    this.currentIdx = (this.currentIdx + 1) % this.queueList.length;
    return data;
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
var justiceQueue = new TweetQueue();
var oaklandQueue = new TweetQueue();

// I don't want to see these.
var blacklist = ['RT', 'bieb', 'justin'];

var fullQueue = new AggregateQueue([painQueue, griefQueue, justiceQueue, oaklandQueue]);

var queueSpec = {
    // "bind up the brokenhearted"
    pain: {
        queue: painQueue,
        kw: ["sad", "depressed", "afraid", "trapped","lonely","grief","cry"],
        kw_req: "i feel",
    },
    // "oil of gladness instead of mourning"
    grief: {
        queue: griefQueue,
        kw: ["passed away", "dead","death","decease","grief","RIP", "R.I.P.", "rest in peace"],
        kw_req: "",
    },
    // "oaks of righteousness"
    oakland: {
        queue: oaklandQueue,
        kw: ["oakland"],
        kw_req: "",
    },
    // "day of vengeance of our God"
    justice: {
        queue: justiceQueue,
        kw: ["injustice","justice","rape","violence","assault","murder","slavery","corruption","mugged"],
        kw_req: "",
    }
};

var subject_kw = ["i feel", "i want", "i need", "i%27m"];

// Set up listeners for each queue.
for (var qtype in queueSpec) {
    // Module pattern
    // http://meshfields.de/event-listeners-for-loop/
    // Binds the queue spec to the scope in the closure.
    (function(qtype) {
        var qd = queueSpec[qtype];
        qd.queue.on('low', function (queueLength) {
            sys.puts('queue ' + qtype + ' is low! refilling...');
            debugger;
            if (!qd.queue.lock) {
                // Set the lock.
                qd.queue.lock = true;
                /**
                 * Do a twitter search
                 */
                twit.search(qd.kw_req + " (" + qd.kw.join(' OR ') + ")", {lang: 'en', rpp: 100}, function(data) {
                    for (var i in data.results) {
                        var text = data.results[i].text;
                        
                        // Filter out blacklisted elements
                        var blacklisted = false;
                        for (var i in blacklist) {
                            var w = blacklist[i];
                            if (text.toLowerCase().indexOf(w.toLowerCase()) != -1) {
                                blacklisted = true;
                                break;
                            }
                        }
                        
                        if (!blacklisted) {
                            qd.queue.push(data.results[i]);
//                            sys.puts(qtype + ' | pushing tweet: ' + sys.inspect(data.results[i]));
//                            sys.puts(qtype + ' | new queue length: ' + qd.queue.queue.length)
                        }
                    }
                });
                // Undo the lock
                qd.queue.lock = false;
            }
        });
    }) (qtype);
}
    
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
var pins = [3, 5, 6, 9]

var arduino = net.createServer(function (stream) {
    
    // Set a reference to the arduino stream from the socket.
    boss.arduino_socket = stream;
    
    stream.setEncoding('utf8');
    stream.on('connect', function() {
        sys.puts('Connection detected from Arduino: ' + sys.inspect(stream, false));
    });
    
    stream.on('data', function(data) {
        sys.puts('Echoing data from arduino client: ' + sys.inspect(data));
        stream.write('Echo: ' + data + '\0');
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
/*    
    setInterval(function () {
        var tweet = fullQueue.shift()
        sys.puts('tweet is: ' + tweet);
    }, 10000);
*/
    // new client is here! 
    client.on('message', function(data){
        sys.puts(sys.inspect('client said:' + data));
    }); 
    client.on('disconnect', function(){
        sys.puts(sys.inspect('client disconnected.'))
    });
});

/**
 * The brains of the whole operation
 *
 * This is responsible for setting up connections to web and arduino.
 */
function EventDriver() {
    EE.call(this);
    this.web_socket = null;
    this.arduino_socket = null;
    this.dummy_i = 0;
}
util.inherits(EventDriver, EE);

EventDriver.prototype.writeArduino = function() {
    // Test function: send a byte-command. Wait for ack before sending another.
    sys.puts('Sending dummy i: ' + this.dummy_i);
    this.arduino_socket.write(pins[this.dummy_i] + '\0');
    this.dummy_i = (this.dummy_i + 1) % 4;
}

/**
 * Checks whether we're properly initialized.
 */
EventDriver.prototype.isReady = function() {
    return this.web_socket != null && 
           this.arduino_socket != null;
}

/**
 * Event loop.
 */
EventDriver.prototype.tick = function() {
    sys.puts('tick');
    // Drain the queue and grab the newest tweet to send.
    var tweet = fullQueue.shift();
    if (tweet) {
        this.web_socket.send(tweet);
        this.writeArduino();
    }
}

boss = new EventDriver();

setInterval(function() {
    if (boss.isReady()) {
        boss.tick();
    }
}, 1000);