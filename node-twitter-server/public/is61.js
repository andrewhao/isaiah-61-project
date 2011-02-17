var tweetQueue = [];
var totalScrollDistance = 0;
var socket = new io.Socket();
$('#clip').attr({height: $(window).height()});
socket.connect();
socket.on('connect', function(){ 
  socket.send('Client notified: connected');
});
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
      var nextTweet = tweetQueue.shift();
      console.log('shifted queue. top should be: ' + nextTweet.h + ', ' + nextTweet.u)
      totalScrollDistance += nextTweet.h;
      console.log('total scroll distance is: ' + totalScrollDistance)
      console.log('tweetQueue is:' + tweetQueue)
      slideTweetStrip(-totalScrollDistance);
  }
  else {
      console.log('visible')
  }
  console.log(data);
});
socket.on('disconnect', function(){
    socket.send('disconnecting!')
});

/**
 * @param toY The Y value (relative to the viewport) the element should slide to.
 */
var slideTweetStrip = function(toY) {
    $('#tweet-strip').css("-webkit-transform","translate(0px, " + toY + "px)");
//    $('#tweet-strip').scrollTop(toY);
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