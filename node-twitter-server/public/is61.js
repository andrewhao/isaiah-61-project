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
        [windowWidth, windowHeight - 300],
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
  var newlyAddedEl = $.tmpl( "tweet", data ).appendTo( "#tweet-strip" );
  var elHeight = newlyAddedEl.outerHeight();
  if (elHeight != null) {
      tweetQueue.push({
          h: elHeight,
          u: data.from_user
      });
  }

  console.log('newly added el height is ' + elHeight);
  
  var isInViewport = newlyAddedEl.offset().top <= $(window).height();

  console.log('is it in viewport?: ' + isInViewport);
  
  if (!isInViewport) {
      socket.send('tweet_offscreen');
      var nextTweet = tweetQueue.shift();
      console.log('shifted queue. top should be: ' + nextTweet.h + ', ' + nextTweet.u)
      totalScrollDistance += nextTweet.h;
      console.log('total scroll distance is: ' + totalScrollDistance)
      console.log('tweetQueue is:' + tweetQueue)
      slideTweetStrip(-totalScrollDistance);
  }
  else {
      socket.send('tweet_onscreen');
      console.log('XXX visible');
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

// Define templates
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