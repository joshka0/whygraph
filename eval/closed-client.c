/* The same transport in every condition. The service owns all condition data. */
#include <sys/socket.h>
#include <sys/un.h>
#include <stdint.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <arpa/inet.h>
static void transfer(int fd, void *buf, size_t n, int sending) {
  char *p = buf;
  while (n) { ssize_t k = sending ? write(fd,p,n) : read(fd,p,n); if(k<=0) {fputs("whygraph service unavailable\n",stderr); exit(70);} p+=k; n-=(size_t)k; }
}
int main(int argc, char **argv) {
  const char *name = strrchr(argv[0],'/'); name = name ? name+1 : argv[0];
  if (strcmp(name,"whygraph")) { fputs("tool unavailable in this evaluation\n",stderr); return 126; }
  int fd = socket(AF_UNIX,SOCK_STREAM,0);
  struct sockaddr_un addr = {.sun_family=AF_UNIX}; strcpy(addr.sun_path,"/whygraph/service.sock");
  if(fd<0 || connect(fd,(struct sockaddr*)&addr,sizeof(addr))) {fputs("whygraph service unavailable\n",stderr); return 70;}
  uint32_t n = htonl((uint32_t)(argc-1)); transfer(fd,&n,4,1);
  for(int i=1;i<argc;i++) { n=htonl((uint32_t)strlen(argv[i])); transfer(fd,&n,4,1); transfer(fd,argv[i],strlen(argv[i]),1); }
  uint32_t header[3]; transfer(fd,header,sizeof(header),0);
  for(int stream=1;stream<=2;stream++) {
    uint32_t left=ntohl(header[stream]); char buf[8192];
    while(left) { size_t count=left<sizeof(buf)?left:sizeof(buf); transfer(fd,buf,count,0); transfer(stream,buf,count,1); left-=(uint32_t)count; }
  }
  close(fd); return (int)ntohl(header[0]);
}
