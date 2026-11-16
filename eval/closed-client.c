/* The same transport in every condition. The service owns all condition data. */
#include <sys/socket.h>
#include <sys/un.h>
#include <stdint.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <arpa/inet.h>
#include <errno.h>
#include <limits.h>
#include <sys/prctl.h>
#include <sys/wait.h>
#include <signal.h>
#include <poll.h>
#include <sys/syscall.h>
static const char *unavailable = "whygraph service unavailable\n";
static void transfer(int fd, void *buf, size_t n, int sending) {
  char *p = buf;
  while (n) { ssize_t k = sending ? write(fd,p,n) : read(fd,p,n); if(k<0 && errno==EINTR) continue; if(k<=0) {fputs(unavailable,stderr); exit(70);} p+=k; n-=(size_t)k; }
}
static int shell_client(int argc, char **argv) {
  unavailable = "whygraph shell launcher unavailable\n";
  int fd=socket(AF_UNIX,SOCK_STREAM,0);
  struct sockaddr_un addr={.sun_family=AF_UNIX}; strcpy(addr.sun_path,"/whygraph/shell.sock");
  if(fd<0 || connect(fd,(struct sockaddr*)&addr,sizeof(addr))) {fputs(unavailable,stderr); return 70;}
  char cwd[PATH_MAX];
  if(!getcwd(cwd,sizeof(cwd))) {fputs(unavailable,stderr); close(fd); return 70;}
  uint32_t n=htonl((uint32_t)argc); transfer(fd,&n,4,1);
  n=htonl((uint32_t)strlen(cwd)); transfer(fd,&n,4,1); transfer(fd,cwd,strlen(cwd),1);
  for(int i=1;i<argc;i++) {n=htonl((uint32_t)strlen(argv[i])); transfer(fd,&n,4,1); transfer(fd,argv[i],strlen(argv[i]),1);}
  int ready[2];
  if(pipe(ready)) {fputs(unavailable,stderr);close(fd);return 70;}
  pid_t parent=getpid(),feeder=fork();
  if(feeder<0) {fputs(unavailable,stderr);close(fd);close(ready[0]);close(ready[1]);return 70;}
  if(feeder==0) {
    close(ready[0]);
    unsigned char ok=prctl(PR_SET_PDEATHSIG,SIGKILL)==0 && getppid()==parent;
    if(write(ready[1],&ok,1)!=1) _exit(70);
    close(ready[1]);if(!ok)_exit(70);
    for(;;) {
      char buf[8192];ssize_t count=read(STDIN_FILENO,buf,sizeof(buf));
      if(count<0 && errno==EINTR)continue;
      if(count<0)count=0;
      uint32_t header[2]={htonl(count?0:1),htonl((uint32_t)count)};
      // The reply reader alone reports transport failure. Input can close after a normal exit.
      char *parts[2]={(char*)header,buf};size_t sizes[2]={8,(size_t)count};
      for(int i=0;i<2;i++)while(sizes[i]) {
        ssize_t k=write(fd,parts[i],sizes[i]);
        if(k<0 && errno==EINTR)continue;
        if(k<=0)_exit(0);
        parts[i]+=k;sizes[i]-=(size_t)k;
      }
      if(!count)_exit(0);
    }
  }
  close(ready[1]);unsigned char ok;transfer(ready[0],&ok,1,0);close(ready[0]);
  if(!ok) {fputs(unavailable,stderr);close(fd);while(waitpid(feeder,NULL,0)<0&&errno==EINTR){}return 70;}
  for(;;) {
    uint32_t header[2]; transfer(fd,header,8,0);
    uint32_t type=ntohl(header[0]),left=ntohl(header[1]);
    if(type==3 && left==4) {
      uint32_t code;transfer(fd,&code,4,0);close(fd);kill(feeder,SIGKILL);
      while(waitpid(feeder,NULL,0)<0&&errno==EINTR){}
      return (int)ntohl(code);
    }
    if(type!=1 && type!=2) {fputs(unavailable,stderr);close(fd);return 70;}
    char buf[8192];
    while(left) {size_t count=left<sizeof(buf)?left:sizeof(buf);transfer(fd,buf,count,0);transfer((int)type,buf,count,1);left-=(uint32_t)count;}
  }
}
/* Host-only scope witness. bwrap holds its first process at --block-fd
 * until this process has bound a pidfd to it. PID reuse cannot satisfy it. */
static int scope_fd=-1;
static void cancel_scope(int signal_number) {
  (void)signal_number;
  int saved_errno=errno;
  if(syscall(SYS_pidfd_send_signal,scope_fd,SIGKILL,NULL,0)<0 && errno!=ESRCH) {
    static const char error[]="shell scope cancellation failed\n";
    ssize_t written=write(2,error,sizeof(error)-1);(void)written;_exit(70);
  }
  errno=saved_errno;
}
static int shell_scope(void) {
  char *line=NULL;size_t size=0;int pid=0;
  while(getline(&line,&size,stdin)>=0) {
    int value;
    if(sscanf(line," \"child-pid\": %d",&value)==1)pid=value;
  }
  free(line);
  if(ferror(stdin)) {perror("shell scope metadata");return 70;}
  if(pid<=0) {fputs("shell scope missing namespace pid\n",stderr);return 70;}
  int fd=(int)syscall(SYS_pidfd_open,pid,0);
  if(fd<0) {perror("shell scope pidfd_open");return 70;}
  scope_fd=fd;
  if(signal(SIGTERM,cancel_scope)==SIG_ERR) {perror("shell scope signal");return 70;}
  if(write(3,"1",1)!=1 || write(1,"R",1)!=1) {perror("shell scope readiness");close(fd);return 70;}
  close(3);
  struct pollfd scope={.fd=fd,.events=POLLIN};int result;
  do {result=poll(&scope,1,-1);}while(result<0 && errno==EINTR);
  if(result!=1 || !(scope.revents&POLLIN)) {fputs("shell scope wait failed\n",stderr);return 70;}
  return 0;
}
int main(int argc, char **argv) {
  const char *name = strrchr(argv[0],'/'); name = name ? name+1 : argv[0];
  signal(SIGPIPE,SIG_IGN);
  if (!strcmp(name,"shell-scope")) return shell_scope();
  if (!strcmp(name,"shell-client")) return shell_client(argc,argv);
  if (strcmp(name,"whygraph")) { fputs("tool unavailable\n",stderr); return 126; }
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
