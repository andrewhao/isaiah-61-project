var sys = require('sys'),
    http = require('http'),
    express = require('express'),
    io = require('socket.io'),
    util = require('util'),
    EE = require('events').EventEmitter,
    chainGang = require('chain-gang'),
    twitter = require('twitter');

/**
 * TweetQueue
 */
function TweetQueue() {
    EE.call(this);
    this.queue = [];
    this.lowThreshold = 10; // The # of queue items the queue contains
                            // or less where a 'low' event will be emitted by
                            // the queue.
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
    
// Create a driver loop that will push out a tweet every n seconds
//setInterval(3000, function() {
    
//})


// In-process queue:
// http://techno-weenie.net/2010/7/13/in-process-node-queues/
// https://github.com/technoweenie/node-chain-gang
// We will use this to trigger a twitter search when a tweet category is nearly
// drained.
// var chain = chainGang.create();

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
 * Socket.io
 */
var socket = io.listen(server); 
socket.on('connection', function(client){
    
    var tweetQueue = new TweetQueue();
    
    var subject_kw = ["i feel", "i want", "i need", "i%27m"];
    var pain_kw = ["sad","depressed","afraid","trapped","lonely","grief","cry"];
    var pain_kw_reqd = ["feel"];
    var grief_kw = ["passed","dead","death","gone","decease","dying","demise","grief"];
    var oakland_kw = ["oakland"];
    var justice_kw = ["injustice","justice","rape","violence","assault","murder","slavery","corruption","mugged"];

    setInterval(function() {
        sys.puts('shifting queue. current length: ' + tweetQueue.queue.length)
        var tw = tweetQueue.shift();
        client.send('sending: ' + tw);
    }, 3000)

    tweetQueue.on('low', function (queueLength) {
        if (queueLength == 0 ||
            queueLength == 10) {
            /**
             * Do a twitter search
             */
            twit.search(pain_kw.join(' OR ') + ' AND ' + pain_kw_reqd.join(' AND '), function(data) {
                for (var i in data.results) {
                    tweetQueue.push(data.results[i].text);
                    sys.puts('pushing tweet: ' + sys.inspect(data.results[i].text));
                    //client.send('searched and found: ' + sys.inspect(data.results[i].text));
                }
            });
        }
    });

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
        sys.puts(sys.inspect('message recv:' + data));
    }); 
    client.on('disconnect', function(){
        sys.puts(sys.inspect('client disconnected'))
    });
});