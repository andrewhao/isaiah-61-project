// twitter-node does not modify GLOBAL, that's so rude
require.paths.unshift('~/.node_libraries');
var sys = require('sys'),
    twitter = require('twitter');

var twit = new twitter({
        consumer_key: 'TsVeZVx6Rs3OpRN4UDom6A',
        consumer_secret: 'RKP5jEu3VzLtJ8WxMFxt3prKUu0grrawqFz3uMw',
        access_token_key: '12176642-TKySLSXlbR5mbbx0daBqtPtZKkUwxFlpA5GxY7u7a',
        access_token_secret: 'fcoeXCzFvZaDYScVyJRuqEpy5jC9SjS8U6V5aZkYptE'
});

twit.stream('statuses/filter', {track: 'foo'}, function(stream) {
        stream.on('data', function (data) {
                sys.puts(sys.inspect(data));
        });
});