var socket = new io.Socket();
socket.connect();
socket.on('connect', function(){ 
  socket.send('Client notified: connected');
});
socket.on('message', function(data){
  $('#message-container').prepend('<p>' + data.text + '</p>');
  console.log(data);
});
socket.on('disconnect', function(){
    socket.send('disconnecting!')
});

