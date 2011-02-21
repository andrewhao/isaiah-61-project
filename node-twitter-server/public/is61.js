var tweetQueue = [];
var totalScrollDistance = 0;

var windowHeight = $(window).height() - 3;
var windowWidth = $(window).width() - 3;
var clippedWindowHeight = windowHeight - 40;
var clippedWindowWidth = windowWidth - 40;

var socket = new io.Socket();
socket.connect();
socket.on('connect', function(){ 
  socket.send('Client notified: connected');
});

var paper = null;

$(document).ready(function () {
    console.log('im ready');
    $('#highlight-overlay').css({
        height: windowHeight,
        width: windowWidth,
        top: 0,
        left: 0
    });
    $('#tweet-clip').css({
        height: clippedWindowHeight
    });
    $('#content, #first-tweet-overlay').css({
        height: clippedWindowHeight,
        width: clippedWindowWidth
    });
    
    // Draw overlay SVG obj
    paper = Raphael('highlight-overlay', windowWidth, windowHeight);
    overlayPathPoints = [
        [0, 50],
        [0, windowHeight],
        [windowWidth, windowHeight],
        [windowWidth, windowHeight - 500],
        [0, 50]];
    overlayPathStr = 'M0 0'
    for (i in overlayPathPoints) {
        p = overlayPathPoints[i];
        overlayPathStr += 'L' + p[0] + ' ' + p[1];
    }
    var c = paper.path(overlayPathStr);
    c.attr({fill: 'red', opacity: 0.7, stroke: 'none'});
    
    // Animate DOM obj.
    $('#first-tweet-overlay .tweet-container').css("-webkit-")
})

socket.on('message', function(data){
  if (data == "") {
    return;
  }
  if (data.typ == 'reply') {

      var data = data.data;
      $('#first-tweet-overlay').html('');
      var newlyAddedEl = $.tmpl( 'c-tweet', data ).appendTo( '#first-tweet-overlay');
      $('#first-tweet-overlay').show();
      setInterval(function() {
          $('#first-tweet-overlay').hide();
      }, 15000);
  }
  if (data.typ == 'search') {
      var data = data.data;
      var newlyAddedEl = $.tmpl( "tweet", data.tweet ).appendTo( "#tweet-strip" );
      var elHeight = newlyAddedEl.outerHeight();
      if (elHeight != null) {
          tweetQueue.push({
              h: elHeight,
              u: data.tweet.from_user,
              id: data.tweet.id_str,
              type: data.tweet_type,
              data: data
          });
      }

      console.log('newly added el height is ' + elHeight);
  
      var isInViewport = newlyAddedEl.offset().top <= $(window).height();

      console.log('is it in viewport?: ' + isInViewport);
  
      if (!isInViewport) {
      
          var nextTweet = tweetQueue.shift();
          var nextNextTweet = tweetQueue[0];
          var nextNextNextTweet = tweetQueue[1];

          // Message the client. This allows the client to go ahead and send the right tweet out.
          socket.send('web:tweet_offscreen:'+nextNextNextTweet.id);
      
          console.log('shifted queue. top should be: ' + nextTweet.h + ', ' + nextTweet.u)
          totalScrollDistance += nextTweet.h;
          console.log('total scroll distance is: ' + totalScrollDistance)
          console.log('tweetQueue is:' + tweetQueue)
      
          slideTweetStrip(-totalScrollDistance);
          transitionTopTweet(nextNextTweet.data);
      
          //console.log('top tweet should be from: '+nextNextTweet.u)
      }
      else {
          socket.send('web:tweet_onscreen:'+data.tweet.id_str);
          console.log('XXX visible');
      }
  }
 // console.log(data);
});
socket.on('disconnect', function(){
    socket.send('disconnecting!')
});

/**
 * @param toY The Y value (relative to the viewport) the element should slide to.
 */
var slideTweetStrip = function(toY) {
    $('#tweet-strip').css("-webkit-transform","translate(0px, " + toY + "px)");
}

/**
 * @param tweetData
 *  The data array containing tweet information.
 */
var transitionTopTweet = function(topTweet) {
    var tweet_dom = $('#tweet_' + topTweet.tweet.id_str + ' .text');
    tweet_dom.css({'color': "#E11F26", 'text-shadow': "text-shadow: 0 -1px -1px #EEC"});
}

// Define templates
// Define templates
$.template(
  "c-tweet",
  '<div class="tweet-container" id="tweet_${id_str}">' +
    '<div class="identifier">' +
        '<img src="${user.profile_image_url}" />' +
        '<div class="from_user">@${user.screen_name}</div>' +
    '</div>' +
    '<div class="tweet">' +
        '<div class="text">${text}</div>' +
        '<div class="created_at">posted ${$.easydate.format_date(new Date(created_at))}</div>' +
    '</div>' +
  '</div>'
);


$.template(
  "tweet",
  '<div class="tweet-container" id="tweet_${id_str}">' +
    '<div class="identifier">' +
        '<img src="${profile_image_url}" />' +
        '<div class="from_user">@${from_user}</div>' +
    '</div>' +
    '<div class="tweet">' +
        '<div class="text">${text}</div>' +
        '<div class="created_at">posted ${$.easydate.format_date(new Date(created_at))}</div>' +
    '</div>' +
  '</div>'
);