// simple socket wrapper
import { io } from "socket.io-client";

let socket = null;
export function connectSocket(serverUrl){
  socket = io(serverUrl, { transports: ['websocket'] });
  socket.on('connect', () => console.log('socket connected', socket.id));
  socket.on('disconnect', () => console.log('socket disconnected'));
  return socket;
}
export function getSocket(){ return socket; }
