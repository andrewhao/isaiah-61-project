// twitter-node does not modify GLOBAL, that's so rude
require.paths.unshift('~/.node_libraries');
var sys = require('sys'),
    http = require('http'),
    express = require('express'),
    io = require('socket.io'),
    twitter = require('twitter');

var server = express.createServer();

/**
 * HTTP server
 */
server.get('/', function(req, res) {
    res.render('index.haml', {locals: {title: 'The Joy Project'}});
});
server.get('/foo', function(req, res) {
    res.send('foo');
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

    var track = 'life'

    /**
     * Define stream behavior
     */
    twit.stream('statuses/filter', {track: track}, function(stream) {
        /**
         * Stream will log on data recv event.
         */
        stream.on('data', function (data) {
                sys.puts(sys.inspect(data.text));
                client.send(data.text);
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