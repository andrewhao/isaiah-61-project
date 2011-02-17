var socket = new io.Socket();
socket.connect();
socket.on('connect', function(){ 
  socket.send('Client notified: connected');
});
socket.on('message', function(data){
  $('#tweet-strip').append('<div class="tweet-container">' + data.text + '</div>');
  console.log(data);
});
socket.on('disconnect', function(){
    socket.send('disconnecting!')
});

