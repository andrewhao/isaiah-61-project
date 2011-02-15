var sys = require('sys'),
    http = require('http'),
    express = require('express'),
    io = require('socket.io'),
    util = require('util'),
    net = require('net'),
    EE = require('events').EventEmitter,
    twitter = require('twitter');

/**
 * QueueBoss
 * Drains from a set of queues in a (random?) and fair manner.
 */
function QueueBoss(queueList, webclient) {
    EE.call(this);
    this.queueList = queueList;
    this.currentIdx = 0;
    this.client = webclient;
}
util.inherits(QueueBoss, EE);

// Shifts the queue, sets up the next one to be shifted next. 
// TODO: randomize
QueueBoss.prototype.drain = function() {
    var tw = this.queueList[this.currentIdx].shift();
    this.client.send(this.currentIdx + ": " + tw);
    this.currentIdx = (this.currentIdx + 1) % this.queueList.length;
}

/**
 * TweetQueue
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
 * Create a twitter stream to the Streaming API
 */
var twit = new twitter({
    consumer_key: 'TsVeZVx6Rs3OpRN4UDom6A',
    consumer_secret: 'RKP5jEu3VzLtJ8WxMFxt3prKUu0grrawqFz3uMw',
    access_token_key: '12176642-TKySLSXlbR5mbbx0daBqtPtZKkUwxFlpA5GxY7u7a',
    access_token_secret: 'fcoeXCzFvZaDYScVyJRuqEpy5jC9SjS8U6V5aZkYptE'
});
    
// Simple web server
var server = express.createServer();

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
var dummy_i = 0;
var arduino = net.createServer(function (stream) {
    stream.setEncoding('utf8');
    stream.on('connect', function() {
        stream.write('Connected to twitter server.\0');
        sys.puts('Connection detected from Arduino: ' + sys.inspect(stream, false));
        
        // Test function: send a command every second
        setInterval(function () {
            sys.puts('Sending dummy i: ' + dummy_i);
            stream.write(dummy_i + '\0');
            dummy_i = (dummy_i + 1) % 3;
        }, 1000)
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
    var painQueue = new TweetQueue();
    var griefQueue = new TweetQueue();
    var justiceQueue = new TweetQueue();
    var oaklandQueue = new TweetQueue();
    
    var queueBoss = new QueueBoss([painQueue, griefQueue, justiceQueue, oaklandQueue], client);
    
    var queueSpec = {
        pain: {
            queue: painQueue,
            kw: ["sad","depressed","afraid","trapped","lonely","grief","cry"],
            kw_req: "i feel",
            ignore: "RT"
        },
        grief: {
            queue: griefQueue,
            kw: ["passed away", "dead","death","decease","grief","RIP", "R.I.P.", "rest in peace"],
            kw_req: "",
            ignore: "RT",
        },
        oakland: {
            queue: oaklandQueue,
            kw: ["oakland"],
            kw_req: "",
            ignore: "RT",
        },
        justice: {
            queue: justiceQueue,
            kw: ["injustice","justice","rape","violence","assault","murder","slavery","corruption","mugged"],
            kw_req: "",
            ignore: "RT",
        }
    };
    
    var subject_kw = ["i feel", "i want", "i need", "i%27m"];

    setInterval(function() {
        queueBoss.drain();
    }, 1000)
    
    // Set up listeners for each queue.
    for (var qtype in queueSpec) {
        // Module pattern
        // http://meshfields.de/event-listeners-for-loop/
        // Binds the queue spec to the scope in the closure.
        (function(qtype) {
            var qd = queueSpec[qtype];
            qd.queue.on('low', function (queueLength) {
                if (!qd.queue.lock) {
                    // Set the lock.
                    qd.queue.lock = true;
                    /**
                     * Do a twitter search
                     */
                    twit.search(qd.kw_req + " (" + qd.kw.join(' OR ') + ")", {lang: 'en', rpp: 30}, function(data) {
                        for (var i in data.results) {
                            var text = data.results[i].text;
                            if (text.indexOf(qd.ignore) == -1) {
                                qd.queue.push(data.results[i].text);
                                sys.puts(qtype + ' | pushing tweet: ' + sys.inspect(data.results[i].text));
                                sys.puts(qtype + ' | new queue length: ' + qd.queue.queue.length)
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
     * Define stream behavior: Justice
     */
//    twit.stream('statuses/filter', {track: grief_kw.concat(subject_kw).join(',')}, function(stream) {
        /**
         * Stream will log on data recv event.
         */
/*        stream.on('data', function (data) {
                var out = data.text
                var words = out.split(' ');
                sys.puts(sys.inspect(out));                

                // Rudimentary search.
                var found = false;                
                for (i in words) {
                    var word = words[i];
                    if (grief_kw.indexOf(word.toLowerCase()) != -1) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    //client.send('pain: ' + out);
                }
                
        });
    });
  */  
    // new client is here! 
    client.on('message', function(data){
        sys.puts(sys.inspect('client said:' + data));
    }); 
    client.on('disconnect', function(){
        sys.puts(sys.inspect('client disconnected.'))
    });
});