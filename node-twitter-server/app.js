var sys = require('sys'),
    http = require('http'),
    express = require('express'),
    io = require('socket.io'),
    util = require('util'),
    twitter = require('twitter');

var server = express.createServer();

/**
 * HTTP server
 */
server.get('/', function(req, res) {
    res.render('index.haml', {locals: {title: 'The Joy Project'}});
});
server.listen(8080);

/**
 * Socket.io
 */
var socket = io.listen(server); 
socket.on('connection', function(client){ 
    /**
     * Create a twitter stream to the Streaming API
     */
    var twit = new twitter({
            consumer_key: 'TsVeZVx6Rs3OpRN4UDom6A',
            consumer_secret: 'RKP5jEu3VzLtJ8WxMFxt3prKUu0grrawqFz3uMw',
            access_token_key: '12176642-TKySLSXlbR5mbbx0daBqtPtZKkUwxFlpA5GxY7u7a',
            access_token_secret: 'fcoeXCzFvZaDYScVyJRuqEpy5jC9SjS8U6V5aZkYptE'
    });
    
    var subject_kw = ["i feel", "i want", "i need", "i%27m"];
    var pain_kw = ["sad","depressed","afraid","trapped","lonely","grief","cry"];
    var pain_kw_reqd = ["feel"];
    var grief_kw = ["passed","dead","death","gone","decease","dying","demise","grief"];
    var oakland_kw = ["oakland"];
    var justice_kw = ["injustice","justice","rape","violence","assault","murder","slavery","corruption","mugged"];

    /**
     * Do a twitter search
     */
    twit.search(pain_kw.join(' OR ') + ' AND ' + pain_kw_reqd.join(' AND '), function(data) {
        for (var i in data.results) {
            sys.puts(sys.inspect(data.results[i].text));
            client.send('searched and found: ' + sys.inspect(data.results[i].text));
        }
    })

    /**
     * Define stream behavior: Justice
     */
    twit.stream('statuses/filter', {track: grief_kw.concat(subject_kw).join(',')}, function(stream) {
        /**
         * Stream will log on data recv event.
         */
        stream.on('data', function (data) {
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
                    client.send('pain: ' + out);
                }
                
        });
    });
    
    // new client is here! 
    client.on('message', function(data){
        sys.puts(sys.inspect('message recv:' + data));
    }); 
    client.on('disconnect', function(){
        sys.puts(sys.inspect('client disconnected'))
    });
});