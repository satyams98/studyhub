export default [
  {
    id: '2.1',
    title: 'Installing Docker (Windows/Mac/Linux)',
    duration: '8 min',
    kind: 'setup',
    summary: [
      'Docker ships in two editions: <strong>Community Edition (CE)</strong>, which is free and is what this entire course uses, and <strong>Enterprise Edition (EE)</strong>, aimed at organizations that need additional support and security features. For everything you\'ll do here, Community Edition is all you need. The exact installation steps differ not just by operating system, but by the version of that operating system too, so before downloading anything, check the official "system requirements" (sometimes labelled "before you install") page for your specific platform - it will tell you definitively whether your machine can run Docker natively.',
      'Mac and Windows both need that compatibility check first. On Windows specifically, Docker natively requires Windows 10 with hardware virtualization enabled - if virtualization is disabled in your BIOS/UEFI, or your Windows version is older than 10, Docker will not start natively no matter how correctly you follow the installer. You can confirm virtualization is enabled by opening Task Manager, going to the Performance tab, and checking the CPU pane. If your machine genuinely can\'t meet these requirements - an older Windows version, or older Mac hardware - <strong>Docker Toolbox</strong> is the fallback: it installs the same Docker CLI and Docker Compose you\'d otherwise get natively, plus Oracle VM VirtualBox, which quietly runs a small Linux virtual machine behind the scenes to host Docker on a system that couldn\'t otherwise run it.',
      'Installing natively on Mac is the most straightforward path: download the installer (a <code>.dmg</code> file) from the stable channel, double-click it, then drag the Docker whale into your Applications folder. Launching it shows the whale icon in your menu bar, and clicking that icon shows Docker\'s running status along with preferences and the installed version. One easy-to-miss gotcha: if your Mac has more than one user account and you run Docker under more than one of them at the same time, you will get errors or conflicts - quit Docker from the menu-bar icon before switching accounts if you need it running under a different one. Windows installation follows the same shape but with one important difference: after the installer finishes, Docker does <strong>not</strong> start automatically. You have to explicitly search for and launch the "Docker Desktop" application yourself the first time, after which the whale icon appears and confirms it is running.',
      'Linux installation is where things genuinely diverge by distribution - Ubuntu, Debian, CentOS, and Fedora each have their own steps, and even the version and CPU architecture of a given distribution can change the exact commands needed, so there is no single universal Linux install guide. What is universal is the recommended <em>approach</em>: install Docker CE from Docker\'s own official package repository, rather than downloading packages manually or running a curl-piped convenience script. The repository method means future upgrades are a normal <code>apt</code> or <code>yum</code> update instead of a manual reinstall, and it\'s the path Docker\'s own documentation recommends. Whichever platform you\'re on, the very last step is always the same: verify the installation actually worked by running a single container, which is exactly where the next lesson picks up.',
    ],
    keyPoints: [
      'Docker has two editions: <strong>Community Edition (CE)</strong> - free, and what this course uses - and <strong>Enterprise Edition (EE)</strong>.',
      'Windows requires <strong>Windows 10</strong> with hardware virtualization enabled (check Task Manager > Performance > CPU) to run Docker natively.',
      'Older or unsupported systems use <strong>Docker Toolbox</strong> instead, which bundles Oracle VM VirtualBox to run a hidden Linux VM underneath Docker.',
      'Always check the official "system requirements" page for your exact OS and version before installing - requirements differ by platform and even by CPU architecture.',
      'On Linux, install from Docker\'s <strong>official package repository</strong> rather than a manual package install or a curl-pipe script, so future upgrades are a normal package-manager update.',
      'On Windows (unlike Mac), Docker does <strong>not</strong> launch automatically after installation - you must start "Docker Desktop" manually the first time.',
    ],
    code: `# --- Ubuntu / Debian: set up Docker's official repository ---
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add the stable repository
echo \\
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \\
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \\
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# --- Install Docker CE from that repository ---
sudo apt-get update
sudo apt-get install -y docker-ce

# List available versions, then pin a specific one (recommended for production)
apt-cache madison docker-ce
sudo apt-get install -y docker-ce=5:24.0.7-1~ubuntu.22.04~jammy

# --- Verify on any platform, including Toolbox setups ---
sudo docker run hello-world`,
    codeLabel: 'terminal',
    note: {
      label: 'WARNING',
      text: 'On Windows, hardware virtualization must be enabled at the BIOS/UEFI level or Docker will refuse to start even after a flawless install. Check Task Manager > Performance > CPU > Virtualization before you troubleshoot anything else.',
      tone: 'accent',
    },
    quiz: {
      question: 'A laptop is running Windows 7 and cannot run Docker natively. What should be installed instead?',
      options: [
        { label: 'Docker Enterprise Edition', correct: false },
        { label: 'Docker Toolbox', correct: true },
        { label: 'Docker Swarm', correct: false },
        { label: 'Kubernetes', correct: false },
      ],
      explanation: 'Docker Toolbox exists precisely for systems - like pre-Windows-10 machines or unsupported Mac hardware - that can\'t run Docker natively. It bundles the same Docker CLI and Compose with Oracle VM VirtualBox, which runs a small Linux VM behind the scenes to host Docker. Enterprise Edition is just a paid tier of Docker itself and doesn\'t address native compatibility; Swarm and Kubernetes are orchestration tools, unrelated to whether Docker can run locally at all.',
    },
  },
  {
    id: '2.2',
    title: 'Verifying Your Installation & Running Your First Container',
    duration: '6 min',
    kind: 'demo',
    summary: [
      'Regardless of which platform or install method the previous lesson walked you through, there is one universal smoke test: <code>docker run hello-world</code>. This single command exercises the entire Docker architecture covered in lesson 1.5 in one shot. The client sends the request to the daemon; the daemon checks for the tiny <code>hello-world</code> image locally, doesn\'t find it, and pulls it from Docker Hub; the daemon then starts a container from that image, whose one job is to print a confirmation message to your terminal. As soon as that message prints, the program has nothing left to do, so it exits - and because a container\'s lifetime is tied to its main process, the container itself stops the instant that process finishes. If you were to run <code>docker ps</code> immediately after, you would not see it listed as running, because it already isn\'t; <code>docker ps -a</code> (covered in full in the next lesson) would still show it as an exited container.',
      'What "it worked" looks like depends a little on your platform, but the underlying signal is identical everywhere: the message beginning with <code>Hello from Docker!</code> appearing in your terminal. On Mac and Windows you can additionally confirm Docker itself is running by clicking the whale icon and checking its status reads "Docker is running" (or "Docker Desktop is running"). If <code>docker run hello-world</code> fails instead with an error like <em>"Cannot connect to the Docker daemon"</em>, that error is pointing you directly at the client/daemon relationship from lesson 1.5: the CLI (client) is working fine, but it cannot reach a daemon, because the daemon process itself isn\'t running yet. The fix is to start Docker Desktop (Mac/Windows) or start the Docker service (Linux: <code>sudo systemctl start docker</code>) and try again.',
      'Two more commands are worth running right alongside <code>hello-world</code>, because they confirm both halves of the architecture are alive rather than just one successful run. <code>docker version</code> prints version information for the client <em>and</em> the server (daemon) separately - if the daemon section fails to print or errors out, that alone tells you the client is installed but the daemon isn\'t reachable, without needing to interpret a `hello-world` failure message. <code>docker info</code> goes further, printing system-wide details about the daemon itself: how many containers and images it currently knows about, which storage driver it\'s using, and general host information. Neither command is something you\'ll run constantly day to day, but both are exactly what you reach for first when something Docker-related isn\'t behaving as expected, in this lesson or much later in the course.',
    ],
    keyPoints: [
      'The universal installation smoke test on every OS is the same single command: <code>docker run hello-world</code>.',
      'It pulls the tiny <code>hello-world</code> image if needed, starts a container from it, prints a confirmation message, and the container exits the instant that one process finishes.',
      'An error like <em>"Cannot connect to the Docker daemon"</em> means the daemon process itself isn\'t running yet - start Docker Desktop (Mac/Windows) or the docker service (Linux) and retry.',
      '<code>docker version</code> prints both the client and the daemon (server) versions separately - a fast way to confirm both halves of Docker\'s architecture are alive and reachable.',
      '<code>docker info</code> reports daemon-wide details (container/image counts, storage driver, host info) - useful when troubleshooting something beyond a single container.',
      'A container\'s lifetime is tied to its main process: once <code>hello-world</code>\'s program finishes printing its message, the container stops on its own, with nothing left running.',
    ],
    code: `$ docker run hello-world

Unable to find image 'hello-world:latest' locally
latest: Pulling from library/hello-world
1b930d010525: Pull complete
Digest: sha256:8e3114318a995a1ee497790535e7b88365222a21771ae7e53a31b8dbc17a516
Status: Downloaded newer image for hello-world:latest

Hello from Docker!
This message shows that your installation appears to be working correctly.

$ docker version
Client:
 Version:           24.0.7
 API version:       1.43
Server: Docker Desktop
 Engine:
  Version:          24.0.7
  API version:      1.43 (minimum version 1.12)

$ docker info
 Containers: 1
  Running: 0
  Stopped: 1
 Images: 1
 Server Version: 24.0.7
 Storage Driver: overlayfs`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'hello-world does nothing useful on purpose - its only job is to prove three things at once: the client can reach the daemon, the daemon can reach a registry, and the daemon can start a container. If it prints the success message, your entire Docker installation is confirmed working end to end, before you ever touch a real application.',
      tone: 'green',
    },
    quiz: {
      question: 'Right after installing Docker, you run docker run hello-world and get: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?" What does this actually mean?',
      options: [
        { label: 'The hello-world image doesn\'t exist and needs to be built manually', correct: false },
        { label: 'The Docker daemon service hasn\'t started yet, even though the CLI is installed', correct: true },
        { label: 'Your machine has no internet connection', correct: false },
        { label: 'You installed Docker for the wrong operating system', correct: false },
      ],
      explanation: 'This exact error message names the daemon socket directly - it means the Docker CLI (client) is installed and working, but it can\'t reach a running Docker daemon process, exactly as described in lesson 1.5\'s client/daemon architecture. The fix is starting Docker Desktop or the docker service, not reinstalling, checking connectivity, or downloading a different image.',
    },
  },
  {
    id: '2.3',
    title: 'Managing Containers: run, ps, stop, start, rm',
    duration: '8 min',
    kind: 'demo',
    summary: [
      'With Docker installed and verified, it\'s time to drill the commands you\'ll type dozens of times a day. Recall the image/container distinction from lesson 1.2: an image is the inert package, a container is a running instance of it. <code>docker run &lt;image&gt;</code> does both jobs in a single command - it pulls the image if it isn\'t local yet, and starts a container from it immediately. By default this runs in the foreground, attached to your terminal: run <code>docker run redis</code> and your terminal is taken over by Redis\'s own output, and pressing <kbd>Ctrl+C</kbd> stops both Redis and the container at once, since they share that one lifetime. Add the <code>-d</code> flag (detached) - <code>docker run -d redis</code> - and Docker instead prints just the new container\'s ID and immediately hands your terminal back, while the container keeps running in the background. Detached mode is what you\'ll use for essentially everything beyond a quick one-off test.',
      'Once something is running detached, you need a way to see it: <code>docker ps</code> lists every currently <strong>running</strong> container, showing its ID, the image it was started from, when it was created, its status, and any ports (covered later in this lesson). By default, Docker assigns each container a randomly generated, faintly amusing name like <code>affectionate_turing</code> - functional, but useless for remembering which container is which once you have several running. Passing <code>--name</code> at creation time fixes that: <code>docker run -d --name redis-cache redis</code> lets you refer to that exact container as <code>redis-cache</code> in every future command, instead of having to look its ID up in <code>docker ps</code> first. This matters more than it sounds like it should - naming your containers now is what makes the debugging commands in the next section (<code>docker logs</code>, <code>docker exec</code>) pleasant to use instead of tedious.',
      '<code>docker ps</code> alone only shows what\'s currently running - a stopped container doesn\'t disappear, it still exists on disk with all its configuration intact, and <code>docker ps -a</code> lists every container regardless of status, running or not. That distinction is what makes <code>docker stop &lt;container&gt;</code> and <code>docker start &lt;container&gt;</code> useful as a pair rather than a one-way trip: <code>docker stop</code> gracefully halts a running container (you only need to type enough leading characters of its ID or name to be unambiguous), and <code>docker start</code> resumes that exact same container later - same name, same configuration, same everything - with no need to run a fresh <code>docker run</code>. Only once you\'re genuinely done with a stopped container and have no intention of resuming it does <code>docker rm &lt;container&gt;</code> come in, permanently deleting its record (a still-running container has to be stopped first, or removed forcibly with <code>docker rm -f</code>).',
      'A realistic scenario ties run, ps, and naming together with something the transcript demoed directly: running two Redis containers side by side, each a different version, so two applications with different dependency requirements can both be satisfied on one machine. Inside its own isolated environment, every Redis container listens on the same internal port, <code>6379</code> - that\'s fine, because it\'s not directly reachable from outside the container until you explicitly publish it with <code>-p host_port:container_port</code>. Two containers can both listen internally on 6379 as long as each one is bound to a <em>different</em> host port; reusing a host port that\'s already bound produces a clear "port is already allocated" error, and the fix is always to change the host-side port, never the container-side one.',
    ],
    keyPoints: [
      '<code>docker run &lt;image&gt;</code> pulls (if needed) and starts a container in one step; by default this is <strong>attached</strong> mode, where <kbd>Ctrl+C</kbd> stops the container along with your terminal session.',
      'Add <code>-d</code> for <strong>detached</strong> mode - the container keeps running in the background and the command returns immediately with just the container ID.',
      'Pass <code>--name</code> at creation time (<code>docker run -d --name redis-cache redis</code>) so you can refer to a container by a name you chose, instead of a random generated one or a looked-up ID.',
      '<code>docker ps</code> shows only <strong>running</strong> containers; <code>docker ps -a</code> shows every container, running or stopped, since a stopped container still exists until removed.',
      '<code>docker stop &lt;container&gt;</code> halts a running container; <code>docker start &lt;container&gt;</code> resumes a stopped one exactly as it was; <code>docker rm &lt;container&gt;</code> permanently deletes a stopped container\'s record once you\'re done with it.',
      'Publish a container\'s internal port to the host with <code>-p host_port:container_port</code>; two containers can listen on the <em>same</em> internal port as long as each is bound to a <em>different</em> host port.',
    ],
    code: `# Run redis in the foreground (attached) - Ctrl+C stops it
docker run redis

# Run redis in the background (detached), with a real name instead of a random one
docker run -d --name redis-cache redis
# 8a3f9c9e2b41...

# List running containers
docker ps
# CONTAINER ID   IMAGE   STATUS         NAMES
# 8a3f9c9e2b41   redis   Up 5 seconds   redis-cache

# List ALL containers, including stopped ones
docker ps -a

# Stop it (name or ID, or just enough leading characters to be unique)
docker stop redis-cache

# Start the exact same container again later - same config, same name
docker start redis-cache

# Permanently remove a stopped container you no longer need
docker rm redis-cache

# Run two Redis containers side by side, both listening internally on 6379,
# each published to a DIFFERENT host port
docker run -d -p 6000:6379 --name redis-latest redis:latest
docker run -d -p 6001:6379 --name redis-legacy redis:4.0
docker ps
# CONTAINER ID   IMAGE          PORTS                    NAMES
# 3c1a2b9d8e40   redis:latest   0.0.0.0:6000->6379/tcp   redis-latest
# 9f2e4d6a1b73   redis:4.0      0.0.0.0:6001->6379/tcp   redis-legacy`,
    codeLabel: 'terminal',
    note: {
      label: 'WARNING',
      text: 'Publishing a second container to a host port that\'s already bound fails with "port is already allocated". The fix is always picking a different HOST port - never the container port - since multiple containers are always free to listen on the same internal port.',
      tone: 'accent',
    },
    quiz: {
      question: 'You already ran docker run -d -p 6000:6379 --name redis-latest redis, and now want a second Redis container running alongside it. Which command works without conflict?',
      options: [
        { label: 'docker run -d -p 6000:6379 --name redis-legacy redis:4.0', correct: false },
        { label: 'docker run -d -p 6001:6379 --name redis-legacy redis:4.0', correct: true },
        { label: 'docker ps -a -p 6000:6379 --name redis-legacy', correct: false },
        { label: 'docker start -p 6001:6379 redis:4.0', correct: false },
      ],
      explanation: 'Two containers can both listen internally on port 6379, but each must be published to a distinct HOST port - reusing host port 6000 triggers "port is already allocated". docker ps doesn\'t accept -p or --name the way docker run does, and docker start resumes an existing container by name/ID, it doesn\'t take a -p flag or an image argument at all.',
    },
  },
  {
    id: '2.4',
    title: 'Managing Images: images, pull, rmi & Docker Hub',
    duration: '7 min',
    kind: 'demo',
    summary: [
      'The previous lesson leaned on the fact that <code>docker run</code> automatically pulls an image if it isn\'t local yet. <code>docker pull &lt;image&gt;:&lt;tag&gt;</code> does just that fetch step on its own, without starting anything - useful when you want an image ready in advance, such as pre-downloading it in a CI pipeline or before going somewhere without internet, rather than paying for the download the first time you actually need to run it. Once you\'ve pulled a few images, <code>docker images</code> lists every one currently sitting on your machine, showing its repository name, tag, image ID, creation date, and size - a quick inventory of exactly what you have locally without having to remember every <code>docker pull</code> you\'ve ever run.',
      'Tags deserve a closer look, because getting them wrong is one of the most common beginner mistakes. Every image on Docker Hub can have many tags representing different versions - <code>redis:4.0</code> and <code>redis:latest</code> are genuinely different images that happen to share a repository name. Omit the tag entirely and Docker defaults to <code>:latest</code>, which sounds convenient but is a moving target: <code>:latest</code> simply points at whatever the maintainer most recently published under that name, so the exact same command, <code>docker pull redis</code>, can silently fetch a different image today than it did six months ago. Production deployments - and anywhere reproducibility matters - should pin an explicit version instead, exactly as lesson 1.2\'s demo did with <code>postgres:9.6</code>.',
      'Docker Hub itself, first toured in lesson 1.2, is where all of this comes from: the default public registry, hosting well over a hundred thousand images. Searching there surfaces two categories worth telling apart - <strong>Official Images</strong>, maintained directly by Docker or by the software\'s own maintainers (the official <code>postgres</code>, <code>redis</code>, and <code>nginx</code> images are exactly this), and unofficial, community-contributed images, which vary enormously in quality and trustworthiness. As a beginner, defaulting to Official Images is the safer starting point every time. You can search Docker Hub from your browser, or without leaving the terminal at all using <code>docker search &lt;term&gt;</code>.',
      'Every image you pull stays on disk taking up space until you explicitly remove it - nothing cleans it up automatically. <code>docker rmi &lt;image&gt;</code> deletes a local image, but only once no container, including a stopped one, still references it; if you get an error that an image is "in use", the fix is to <code>docker rm</code> the dependent container first (exactly the command from the previous lesson) and then retry <code>docker rmi</code>. For clearing out everything unused in one pass rather than tracking down individual images and containers by hand, <code>docker system prune</code> removes unused images, stopped containers, and dangling networks together - a genuinely useful habit once your machine has accumulated a few weeks\' worth of pulled images you no longer need.',
    ],
    keyPoints: [
      '<code>docker pull &lt;image&gt;:&lt;tag&gt;</code> downloads an image without starting a container - useful for pre-fetching or updating an image on its own.',
      '<code>docker images</code> lists every image already on your machine, with its repository name, tag, image ID, and size.',
      'Omitting a tag defaults to <code>:latest</code>, which can silently point to a different image over time; production workloads should <strong>pin an explicit version</strong> instead, as lesson 1.2 did with <code>postgres:9.6</code>.',
      'Docker Hub\'s <strong>Official Images</strong> (e.g. official <code>postgres</code>, <code>redis</code>, <code>nginx</code>) are maintained by Docker or the project itself and are the safer default over unofficial community images.',
      '<code>docker rmi &lt;image&gt;</code> deletes a local image, but only once no container - even a stopped one - still references it; remove the dependent container with <code>docker rm</code> first.',
      '<code>docker system prune</code> removes unused images, stopped containers, and dangling networks in one command - a fast way to reclaim disk space.',
    ],
    code: `# Pre-download an image without running it
docker pull redis:4.0

# List every image currently on this machine
docker images
# REPOSITORY   TAG       IMAGE ID       CREATED        SIZE
# redis        4.0       a1b2c3d4e5f6   3 weeks ago    98.2MB
# redis        latest    f6e5d4c3b2a1   5 days ago     117MB
# postgres     9.6       9f8e7d6c5b4a   2 months ago   200MB

# Search Docker Hub without leaving the terminal
docker search postgres
# NAME                 DESCRIPTION                    STARS   OFFICIAL
# postgres             The PostgreSQL object...       13500   [OK]
# bitnami/postgresql   Bitnami container image...      450

# Removing an image fails while a container still references it
docker rmi redis:4.0
# Error response from daemon: conflict: unable to remove repository reference
# "redis:4.0" (must force) - container 8a3f9c9e2b41 is using its referenced image

# Fix: remove the dependent container first, then the image
docker rm redis-legacy
docker rmi redis:4.0

# Reclaim disk space from everything unused in one pass
docker system prune`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Pin explicit version tags (redis:4.0, not redis:latest) anywhere reproducibility matters. A teammate, or a production server, pulling :latest months from now can silently get a different image than the one you actually tested against.',
      tone: 'green',
    },
    quiz: {
      question: 'You run docker rmi postgres:9.6 and get an error that the image is in use by a container. What is the correct next step?',
      options: [
        { label: 'Run docker pull postgres:9.6 again to refresh it', correct: false },
        { label: 'Remove the dependent container with docker rm first, then retry docker rmi', correct: true },
        { label: 'Restart Docker Desktop and try again immediately', correct: false },
        { label: 'Use docker images -a to force the deletion', correct: false },
      ],
      explanation: 'An image can\'t be removed while any container - running or stopped - still references it, because that container\'s configuration depends on it. Pulling the image again or restarting Docker doesn\'t change that dependency; the actual fix is removing the dependent container first with docker rm, which is exactly what frees the image up for docker rmi to succeed.',
    },
  },
  {
    id: '2.5',
    title: 'Docker CLI Cheat Sheet',
    duration: '5 min',
    kind: 'summary',
    summary: [
      'This lesson introduces no new commands - its only purpose is to gather everything from lessons 2.1 through 2.4 into a single place you can scan without re-reading each lesson individually. The commands below are grouped the same way they were taught: verify the installation, then manage images, then manage containers, then clean up. Treat this as the page you keep open in a second tab the first several times you sit down to actually use Docker.',
      'On the image side: <code>docker pull</code> fetches an image without running it, <code>docker images</code> lists what you already have locally, <code>docker search</code> looks up Docker Hub from the terminal, and <code>docker rmi</code> deletes a local image once nothing depends on it anymore. Remember the version-pinning habit from lesson 2.4 - specify an explicit tag rather than relying on the ever-shifting <code>:latest</code>.',
      'On the container side: <code>docker run</code> (optionally with <code>-d</code> for detached mode and <code>--name</code> for a real name instead of a random one) creates and starts a container; <code>docker ps</code> and <code>docker ps -a</code> list running or all containers respectively; <code>docker stop</code>, <code>docker start</code>, and <code>docker rm</code> cover the rest of a container\'s lifecycle. <code>-p host_port:container_port</code> is how you make a container reachable from outside itself at all - without it, whatever a container listens on internally stays invisible to the host.',
      'Everything on this list is still just the architecture from lesson 1.5 in motion: the Docker CLI (client) sending each of these commands to the daemon, which manages images and containers on your behalf and talks to a registry whenever an image needs fetching. If you can place any new command you meet later in the course into that four-piece model - client, daemon, image, registry - remembering what it does gets much easier. The next section builds directly on this CLI fluency to actually debug a running container when something goes wrong, using <code>docker logs</code> and <code>docker exec</code>.',
    ],
    keyPoints: [
      '<strong>Verify install:</strong> <code>docker run hello-world</code>, <code>docker version</code>, <code>docker info</code>.',
      '<strong>Images:</strong> <code>docker pull &lt;image&gt;:&lt;tag&gt;</code>, <code>docker images</code>, <code>docker search &lt;term&gt;</code>, <code>docker rmi &lt;image&gt;</code>.',
      '<strong>Containers:</strong> <code>docker run [-d] [--name x] &lt;image&gt;</code>, <code>docker ps</code>, <code>docker ps -a</code>, <code>docker stop &lt;c&gt;</code>, <code>docker start &lt;c&gt;</code>, <code>docker rm &lt;c&gt;</code>.',
      '<strong>Networking:</strong> <code>-p host_port:container_port</code> publishes a container\'s internal port to the host so it becomes reachable.',
      '<strong>Cleanup:</strong> <code>docker system prune</code> removes unused images, stopped containers, and dangling networks in one command.',
    ],
    code: `### Install & verify
docker version                              # client + daemon versions
docker info                                 # daemon-wide details
docker run hello-world                      # smoke-test the whole installation

### Images
docker pull <image>:<tag>                   # download without running
docker images                               # list images stored locally
docker search <term>                        # search Docker Hub from the CLI
docker rmi <image>:<tag>                    # delete a local image (must be unused)

### Containers
docker run <image>                          # pull (if needed) + start, attached
docker run -d --name web nginx              # detached, named
docker run -d -p 8080:80 --name web nginx   # detached, named, port-published
docker ps                                   # list running containers
docker ps -a                                # list ALL containers (running + stopped)
docker stop <container>                     # gracefully stop a running container
docker start <container>                    # resume a stopped container
docker rm <container>                       # permanently delete a stopped container

### Cleanup
docker system prune                         # remove unused images/containers/networks`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: 'Every command above is just the Docker CLI (client) asking the daemon to act on one of two things - an image or a container - exactly the architecture from the end of Section 1. Placing a new command into that model is what makes it easy to remember instead of memorizing dozens of commands as unrelated facts.',
      tone: 'accent',
    },
    quiz: {
      question: 'Which single command lists every container on your machine, including ones that are currently stopped?',
      options: [
        { label: 'docker ps', correct: false },
        { label: 'docker ps -a', correct: true },
        { label: 'docker images -a', correct: false },
        { label: 'docker inspect', correct: false },
      ],
      explanation: 'docker ps alone only shows running containers. Adding -a includes stopped ones too, which matters because a stopped container still exists on disk until you docker rm it. docker images -a lists intermediate image layers rather than containers, and docker inspect returns detailed JSON about a single object, not a list of containers.',
    },
  },
]
