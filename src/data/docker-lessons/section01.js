export default [
  {
    id: '1.1',
    title: 'Why Containers? The Problem They Solve',
    duration: '6 min',
    kind: 'theory',
    summary: [
      'Before you can appreciate what a container is, you have to feel the pain it was built to remove. Picture a development team building a JavaScript application that depends on PostgreSQL for storage and Redis for messaging. Without containers, every single developer on that team has to install those services directly onto their own operating system: download the right binaries, run the installer, configure the data directory, the port, the credentials — then repeat all of that again for the next dependency, and the one after that. If the application depends on ten services, that is ten separate installation procedures, run by hand, on every teammate\'s machine. Worse, the exact steps differ depending on whether that teammate is on Windows, macOS, or a specific Linux distribution, so "it works on my machine" isn\'t a joke, it\'s the default outcome. More manual steps means more opportunities for a typo, a mismatched version, or a missed configuration flag to quietly break the setup.',
      'The same category of pain shows up again at deployment time, just between different people. A traditional deployment hands operations a build artifact — say, a <code>.jar</code> file — plus a written guide describing how to install and configure everything that artifact needs on the server: the database, the message broker, environment variables, the works. Because all of those services usually end up installed directly on the same host operating system, you can get dependency-version conflicts between them. And because the instructions are just text, they are only as good as whoever wrote them remembered to include — when a step is missing or unclear, operations has to go back to the development team, wait for clarification, and try again. That back-and-forth is slow, and it scales badly as the number of services and environments grows.',
      'A container solves both problems the same way: it packages an application together with everything that application needs to run — its dependencies, its configuration, its runtime — into one self-contained, portable unit. Because the container carries its own environment with it, nobody installs PostgreSQL or Redis onto their operating system directly anymore; they simply fetch the already-configured package and start it. That package behaves identically no matter which OS is underneath it, which is precisely why the "it works on my machine" problem largely disappears — the container\'s environment <em>is</em> the machine, as far as the application inside it is concerned. The next lesson gets technical about exactly what that package is made of and pulls one down to prove the point hands-on.',
      'Portable packages need somewhere to live so they can be found, shared, and moved between machines — that place is called a container repository (you will also hear it called a registry). Many companies run their own private repository; there is also a large public one for Docker containers that anyone can browse and pull from, which the next lesson tours directly. Once a dependency\'s container is sitting in a repository, getting it running locally — or on a server — stops being a multi-step manual installation and becomes a single command that fetches the package and starts it in one action. That is the whole payoff: the same one-line command works for the first developer\'s machine, the tenth developer\'s machine, and the production server, regardless of what operating system any of them are running.',
    ],
    keyPoints: [
      'Without containers, every developer manually installs and configures each dependency (databases, message brokers, etc.) directly on their own OS — a process that differs by OS and multiplies with every service and every teammate.',
      'Traditional deployment hands operations a build artifact plus <em>written instructions</em> for installing its dependencies on the server by hand, which causes both dependency-version conflicts and slow back-and-forth when a step is missing.',
      'A container packages an application with <strong>everything it needs</strong> — dependencies, configuration, and runtime — into one portable, self-contained unit.',
      'Because the container carries its own environment, the same package behaves identically regardless of the underlying operating system.',
      'Portable containers are stored in and pulled from a <strong>container repository</strong> — a private company-run one, or a public one such as Docker Hub, covered next.',
    ],
    code: `# WITHOUT containers - manual, per-developer, per-OS setup
#  1. Download PostgreSQL binaries for your specific OS
#  2. Run the installer / package manager and wait
#  3. Configure the data directory, port, and credentials by hand
#  4. Repeat steps 1-3 for Redis, and again for every other dependency
#  5. Repeat the ENTIRE process on every teammate's machine, and again on the server

# WITH containers - one command per dependency, identical on every OS
docker run -d --name postgres-db -e POSTGRES_PASSWORD=secret postgres:9.6
docker run -d --name redis-cache redis:latest

# Same two commands. Same result. Windows, macOS, or Linux - doesn't matter.`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The core value of a container isn\'t speed or novelty - it\'s eliminating configuration drift. When the dependency and its exact configuration travel together as one package, "it works on my machine" stops being an excuse, because everyone is running the literal same environment.',
      tone: 'accent',
    },
    quiz: {
      question: 'A team\'s application depends on 10 separate services. What specific problem does packaging each one as a container solve, compared to installing them directly on each developer\'s OS?',
      options: [
        { label: 'It makes the application\'s source code run faster', correct: false },
        { label: 'It removes per-OS install differences and manual configuration steps, so the same package behaves identically everywhere', correct: true },
        { label: 'It automatically writes the application\'s business logic', correct: false },
        { label: 'It replaces the need for a version control system', correct: false },
      ],
      explanation: 'Containers don\'t change how fast code executes or write logic for you - they eliminate the repeated, error-prone, OS-specific manual installation and configuration work by packaging a dependency with everything it needs, so the exact same package runs identically on any machine.',
    },
  },
  {
    id: '1.2',
    title: 'What Is a Docker Container? Images, Layers & Your First Pull',
    duration: '7 min',
    kind: 'demo',
    summary: [
      'The previous lesson described a container conceptually, as a portable package containing everything an application needs. Technically, that package is built from <strong>images</strong> stacked in layers. At the base of nearly every container sits a small Linux-based image — often a minimal distribution like Alpine — chosen specifically because keeping the base layer small keeps the whole container small, which is one of the advantages containers have over heavier alternatives. On top of that base layer sits an application layer (the actual software you want to run, such as PostgreSQL), and on top of that, the configuration data the application needs. In a real image there are usually several intermediate layers between the base and the final application layer, but that three-layer mental model — base OS, application, configuration — is enough to reason about what you\'re actually downloading.',
      'To see this in action, head to Docker Hub (Docker\'s public repository, introduced in the previous lesson) and search for <code>postgres</code>. You\'ll see the official PostgreSQL image with a long list of available versions. Say you specifically need an older one, <code>9.6</code> — you can pull and start it with a single command: <code>docker run postgres:9.6</code>. The first line of output tells you Docker couldn\'t find that image locally, so it reaches out to Docker Hub to fetch it. What follows is a series of hashes downloading in parallel — those are the individual layers described above, being pulled down one at a time. Once the layers finish downloading, the command doesn\'t just fetch the image, it also starts it immediately, so you\'ll see PostgreSQL\'s own startup output scroll by, ending in a line like <code>database system is ready to accept connections</code>.',
      'The layered structure isn\'t just an implementation detail — it directly saves you time. If you later need a different version of the same application, say <code>postgres:10.10</code>, Docker only downloads the layers that actually differ between the two versions; any layer identical to one you already have (very often the base OS layer) is reused from disk rather than re-fetched. The first pull of an image can take several minutes; a later version of that same image, sharing most of its layers, can download in a fraction of the time.',
      'This demo also makes the distinction between an <strong>image</strong> and a <strong>container</strong> concrete, since the two terms get confused constantly. An image is the packaged artifact itself — inert, just sitting in a repository or on disk, not doing anything. The moment you start that image, the application inside actually runs, and that running instance is the container. Confirm it with <code>docker ps</code>, which lists your currently running containers — you\'ll see PostgreSQL 9.6 listed there with a container ID, the image it was started from, and other status details. Nothing stops you from doing this again with a second version at the same time: running <code>postgres:10.10</code> alongside the already-running <code>9.6</code> produces two independent, isolated containers with zero conflict between them, each with its own container ID in <code>docker ps</code>.',
    ],
    keyPoints: [
      'An image is layered: a small <strong>base OS layer</strong> (often a minimal distro like Alpine, chosen to keep the image small) → an <strong>application layer</strong> → <strong>configuration data</strong> on top.',
      '<code>docker run &lt;image&gt;:&lt;tag&gt;</code> pulls the image if it isn\'t already local, then immediately starts a container from it in one step.',
      'Docker only downloads the layers that differ between versions of the same image - identical layers already on disk are reused, which is why a second version of an image you already have pulls much faster.',
      '<strong>Image</strong> = the packaged, inert artifact sitting in a repository or on disk; <strong>container</strong> = that image actually running as a live process, visible in <code>docker ps</code>.',
      'Multiple containers - even different versions of the exact same application - can run side by side on one machine with no conflict, because each is its own isolated environment.',
    ],
    code: `# Pull and run PostgreSQL 9.6 (not found locally yet)
docker run postgres:9.6

# Unable to find image 'postgres:9.6' locally
# 9.6: Pulling from library/postgres
# a5ae9b8931d0: Pull complete
# 4a3d9e9c1a2b: Pull complete
# ... (remaining layers downloading)
# Status: Downloaded newer image for postgres:9.6
# PostgreSQL init process complete; ready for start up
# database system is ready to accept connections

# In a second terminal, list running containers
docker ps
# CONTAINER ID   IMAGE          STATUS          NAMES
# 3f1a9c7e2b40   postgres:9.6   Up 30 seconds   affectionate_turing

# Run a second, different version alongside the first - no conflict
docker run postgres:10.10
docker ps
# CONTAINER ID   IMAGE           STATUS          NAMES
# 3f1a9c7e2b40   postgres:9.6    Up 2 minutes    affectionate_turing
# 9b2e4f8a1d63   postgres:10.10  Up 15 seconds   nostalgic_mendel`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: 'Layered images are why Docker feels almost instantaneous after the first pull: fetching postgres:10.10 after already having 9.6 only downloads the layers that actually changed, not the whole image over again.',
      tone: 'accent',
    },
    quiz: {
      question: 'You already have postgres:9.6 downloaded locally, and now run docker run postgres:10.10 for the first time. What happens?',
      options: [
        { label: 'Docker re-downloads the entire postgres:10.10 image from scratch', correct: false },
        { label: 'Docker downloads only the layers that differ from what you already have, reusing the rest', correct: true },
        { label: 'Docker refuses, since 9.6 is already running', correct: false },
        { label: 'Docker overwrites your existing postgres:9.6 container with 10.10', correct: false },
      ],
      explanation: 'Because images are built from layers, Docker compares what you already have on disk against the new image\'s layers and only fetches the ones that are actually different - typically the application layer, not the shared base OS layer. Your existing 9.6 container is untouched; the two versions can run simultaneously.',
    },
  },
  {
    id: '1.3',
    title: 'Containers vs Virtual Machines',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'The previous two lessons established what a container is and why it exists: a portable package plus an isolated place for it to run. But isolation itself can be achieved in more than one way, and it\'s worth understanding the alternative, because you will hear "just use a VM" as a suggestion throughout your career. A <strong>virtual machine</strong> achieves isolation by virtualizing <em>hardware</em>. A piece of software called a hypervisor sits either directly on physical hardware ("Type 1", such as VMware ESXi or Microsoft Hyper-V) or on top of a host operating system ("Type 2", such as VirtualBox or VMware Workstation), and it carves up the real CPU, memory, disk, and network interface into virtual equivalents. Each VM then boots its own complete, independent guest operating system on top of that virtual hardware — its own kernel, its own drivers, all of it — exactly as if it were a separate physical computer.',
      'A <strong>container</strong> takes a fundamentally different approach: instead of virtualizing hardware, it virtualizes the operating system itself. All the containers running on a given machine share that one machine\'s single kernel - there is no second kernel booting inside a container the way there is inside a VM. Isolation between containers is instead provided by two Linux kernel features working together: <strong>namespaces</strong>, which give each container its own private view of things like process IDs, network interfaces, and the filesystem, so a process inside one container cannot see or touch another container\'s processes or files; and <strong>cgroups</strong> (control groups), which cap and account for how much CPU, memory, and disk I/O each container is allowed to consume, so a runaway container can\'t starve the others of resources. Between them, namespaces and cgroups reproduce most of what feels like VM-style isolation, without a second OS kernel anywhere in sight.',
      'That single difference — booting a whole guest kernel versus sharing the host\'s one kernel — explains essentially every practical gap between the two. A container starts in well under a second because there\'s no OS to boot, only a process to launch; a VM typically takes anywhere from tens of seconds to a couple of minutes, because an entire operating system has to boot from scratch first. Image sizes follow the same logic: a container image is often just a few megabytes to a few hundred, because it only needs to bundle an application and a thin base layer (as covered in the previous lesson); a VM image usually runs into gigabytes, because it has to bundle an entire operating system\'s worth of files. This is exactly why a single laptop can comfortably run dozens of containers side by side, but would struggle to run more than a handful of full VMs with the same hardware.',
      'None of that makes VMs obsolete. Sharing one kernel across every container on a host means a container\'s isolation, while strong, ultimately rests on that one shared kernel behaving correctly - a security flaw in the kernel itself is a much bigger deal for containers than for VMs, where a hypervisor boundary sits between every guest and the hardware. For workloads that are genuinely untrusted, or that must run in strict multi-tenant isolation, that hypervisor boundary is still the stronger, industry-standard guarantee. There\'s also a hard technical limit: a container can only run software built for its host\'s kernel, which is why a Linux container needs a Linux kernel underneath it (and why Docker Desktop on macOS or Windows quietly runs a small Linux VM behind the scenes to host Linux containers). If you need to run a genuinely different OS kernel side by side with your host\'s, that\'s a job for a VM, not a container.',
    ],
    keyPoints: [
      'A <strong>virtual machine</strong> virtualizes hardware: a hypervisor gives each VM virtual CPU/RAM/disk, and each VM boots its own complete, independent guest OS kernel.',
      'A <strong>container</strong> virtualizes the operating system instead: every container on a host shares that host\'s single kernel - there is no second kernel booting per container.',
      'Container isolation comes from two Linux kernel features: <strong>namespaces</strong> (an isolated view of processes, network, and filesystem per container) and <strong>cgroups</strong> (limits on how much CPU/memory/IO each container may consume).',
      'Because there\'s no OS to boot, containers start in well under a second with images often just megabytes; VMs take tens of seconds to minutes to boot and their images typically run into gigabytes.',
      'Reasons to still choose a VM: needing a genuinely different OS kernel than the host, or needing a hypervisor\'s stronger isolation boundary for untrusted, multi-tenant workloads.',
    ],
    code: `# Virtual machine: each guest boots its own full OS kernel
#   Physical hardware -> Hypervisor -> [ Guest OS #1 kernel -> App A ]
#                                   -> [ Guest OS #2 kernel -> App B ]
#   Typical boot time: ~30s-2min      Typical image size: 1-20+ GB

# Container: every container shares the ONE host kernel
#   Physical hardware -> Host OS (single kernel) -> Container runtime
#                                                 -> [ namespaces + cgroups -> App A ]
#                                                 -> [ namespaces + cgroups -> App B ]
#   Typical start time: <1 second     Typical image size: 5MB-a few hundred MB`,
    codeLabel: 'diagram',
    note: {
      label: 'WHEN TO USE',
      text: 'Reach for a VM instead of a container when you must run a different OS kernel than the host, or when you need a hypervisor\'s hard security boundary for genuinely untrusted, multi-tenant workloads. For everything else, containers give you most of the same isolation at a fraction of the resource cost and startup time.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why can a single Docker host comfortably run dozens of lightweight containers, but the same hardware could only run a handful of full virtual machines?',
      options: [
        { label: 'Containers contain less application code than VMs', correct: false },
        { label: 'Containers share the host\'s single kernel instead of each booting a full guest OS', correct: true },
        { label: 'Containers don\'t provide any isolation between workloads', correct: false },
        { label: 'VMs require a Kubernetes cluster to run at all', correct: false },
      ],
      explanation: 'The deciding factor is that every VM boots and runs an entire independent guest OS kernel on virtualized hardware, which costs real CPU, memory, and boot time per VM. Containers skip that entirely by sharing the host\'s one kernel and using namespaces/cgroups for isolation instead - they still isolate workloads from each other, just without the overhead of a second kernel.',
    },
  },
  {
    id: '1.4',
    title: 'Docker vs Kubernetes vs Docker Swarm',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'It\'s tempting to assume Docker and Kubernetes are competing technologies, since they get mentioned in the same breath so often - but they are not alternatives to each other, and in most real projects they are used together. Docker, as the previous three lessons covered, is a container technology: it builds, packages, and runs individual containers, and it particularly shines at automating the build-and-deployment pipeline, which is why it\'s so widely used in local development and CI/CD. Kubernetes is a different kind of tool entirely - it\'s infrastructure for managing containers once they already exist. Kubernetes only enters the picture after an application has already been built and packaged into a container image; from there, it takes over the job of scheduling, scaling, and managing those deployed containers automatically, across a whole cluster of machines rather than just one.',
      'Put the two together and you get a realistic end-to-end pipeline. Locally, a developer uses Docker containers for the services their application depends on (databases, message brokers - exactly as covered in lesson 1.1). In continuous integration, Docker builds the application itself into an image and pushes that image into a container repository, private or public. Separately, a cluster of physical or virtual servers has Kubernetes installed across them; once that cluster exists, Kubernetes pulls the pushed image from the repository and runs it as a container, distributing however many containers you need across however many nodes make up the cluster. The Kubernetes component that actually makes this possible on each individual node is called the <strong>kubelet</strong> - every node in a Kubernetes cluster runs one, and it\'s the piece that enables Docker containers to actually run under Kubernetes\' control on that specific machine.',
      'The technology genuinely comparable to Kubernetes - its direct alternative, not its companion - is <strong>Docker Swarm</strong>, Docker\'s own built-in container orchestration tool. Where a Kubernetes cluster is made of nodes each running a kubelet, a Docker Swarm cluster is made of nodes each running a plain Docker daemon (the same background service introduced conceptually in the next lesson); and where Kubernetes needs its own engine to span multiple nodes into one cluster, Docker itself does that job directly in a Swarm setup. Once the cluster exists, the rest looks the same either way: the same Docker containers, running the same application images, just orchestrated by a different tool underneath.',
      'The two orchestrators trade off differently. Kubernetes is considerably more complex to install and operate, and comes with a steeper learning curve - including an entirely new command-line tool, <code>kubectl</code>, on top of everything you already know from the Docker CLI. In exchange, it\'s far more powerful: it supports auto-scaling out of the box and ships with built-in monitoring, neither of which Docker Swarm has natively (Swarm needs scaling configured manually and depends on third-party tools for monitoring). Swarm does have one advantage worth naming: built-in automatic load balancing, which Kubernetes does not provide natively on its own. And because Swarm is just an extension of Docker itself, there\'s no second CLI to learn - the same <code>docker</code> commands you\'re already using keep working. Despite the steeper learning curve, Kubernetes\' greater power is why it has become the dominant choice for anything beyond a small or simple deployment, which is exactly why this course dedicates its later sections to it.',
    ],
    keyPoints: [
      'Docker and Kubernetes are <strong>not competitors</strong> - Docker builds and runs individual containers; Kubernetes orchestrates many already-built containers across a cluster of machines. Most real projects use both together.',
      'The typical pipeline: Docker packages an app into an image locally and in CI, pushes it to a registry, and a separate Kubernetes cluster then pulls and runs that image across multiple nodes.',
      'Every node in a Kubernetes cluster runs a <strong>kubelet</strong> - the component that actually lets Kubernetes start and manage Docker containers on that node.',
      '<strong>Docker Swarm</strong> is Kubernetes\' direct alternative: an orchestrator built into Docker itself, where each node runs a plain Docker daemon instead of a kubelet.',
      'Kubernetes trades a steeper learning curve and a new CLI (<code>kubectl</code>) for more power - auto-scaling and built-in monitoring; Docker Swarm trades some of that power for simplicity, the familiar <code>docker</code> CLI, and built-in load balancing.',
    ],
    code: `# Local dev & CI (Docker)                Production cluster (Kubernetes)
# ------------------------                ------------------------------
# docker build -t myapp:1.0 .             kubectl apply -f deployment.yaml
# docker push myregistry/myapp:1.0                |
#          |                                      v
#          v                             Kubernetes schedules the container
#   Container repository  -----------> onto a node; that node's kubelet
#   (Docker Hub, AWS ECR,               pulls the image and runs it as a
#    a private registry, ...)            Docker container.

# The direct alternative to this Kubernetes cluster: Docker Swarm
#   - each node runs a Docker daemon instead of a kubelet
#   - you manage it with the same 'docker' CLI, no 'kubectl' required`,
    codeLabel: 'diagram',
    note: {
      label: 'DECISION POINT',
      text: 'Stick with plain Docker (and Docker Compose for multi-container setups) while everything runs on one machine. The moment you need containers scheduled, scaled, and kept healthy automatically across multiple machines, that is the signal to bring in an orchestrator - Kubernetes if you need its power and can absorb the learning curve, Docker Swarm if you want something lighter that reuses the Docker CLI you already know.',
      tone: 'accent',
    },
    quiz: {
      question: 'A team wants auto-scaling and built-in monitoring for their container cluster, and is willing to accept a steeper learning curve and a new CLI to get it. Which orchestrator fits, based on the comparison in this lesson?',
      options: [
        { label: 'Docker Swarm', correct: false },
        { label: 'Kubernetes', correct: true },
        { label: 'The plain Docker CLI with no orchestrator', correct: false },
        { label: 'Docker Compose', correct: false },
      ],
      explanation: 'Kubernetes offers auto-scaling and built-in monitoring natively, at the cost of more complex setup and a separate CLI (kubectl). Docker Swarm is lighter and reuses the Docker CLI, but needs scaling configured manually and relies on third-party monitoring tools. Plain Docker and Docker Compose run containers on a single machine and don\'t orchestrate a multi-machine cluster at all.',
    },
  },
  {
    id: '1.5',
    title: 'Docker Architecture: Client, Daemon, Images & Registries',
    duration: '5 min',
    kind: 'summary',
    summary: [
      'This lesson doesn\'t introduce new commands - it connects everything from this section into one mental model, because every Docker concept you\'ve seen so far is really just one of four pieces cooperating. When you type a <code>docker</code> command, you\'re talking to the <strong>Docker CLI</strong> - a thin client that does not run containers itself. Instead, it sends your request to the <strong>Docker daemon</strong> (the background service <code>dockerd</code>), which is the component that actually manages images, containers, networks, and volumes on a machine. Client and daemon talk to each other over a REST API, and while they usually live on the same machine during local development, they don\'t have to - the exact same <code>docker</code> commands work identically against a daemon running on a remote server.',
      'The other two pieces are ones you\'ve already used hands-on. An <strong>image</strong> is the layered, read-only package described in lesson 1.2 - a base OS layer, an application layer, and configuration, bundled together as one portable artifact. A <strong>container</strong> is what you get when the daemon actually starts that image: an isolated, running instance of it, kept separate from other containers and the host itself by the namespaces and cgroups covered in lesson 1.3. The image never changes once built; the container is the live, running thing that comes from it.',
      'Images don\'t just appear on your machine - they live in a <strong>registry</strong>, as introduced back in lesson 1.1. Docker Hub is the default public registry: over a hundred thousand images, spanning official images (maintained by Docker or the software\'s own maintainers, like the <code>postgres</code> and <code>redis</code> images pulled in lesson 1.2) and community-contributed ones. Companies also commonly run private registries for their own internal images. <code>docker pull</code> fetches an image from a registry to your machine; <code>docker push</code> (which you\'ll use once you start building your own images later in the course) uploads one there.',
      'Put together, that\'s the whole architecture: a client sends a command to a daemon, the daemon pulls an image from a registry if it needs to, and the daemon starts that image as an isolated container. A single daemon is enough to manage every container on one machine, which is all lessons 1.1-1.4 of this section needed. The moment you need containers coordinated across <em>many</em> machines at once, a single daemon isn\'t enough anymore - which is exactly the gap Kubernetes and Docker Swarm exist to fill, as covered in the previous lesson. The next section puts this architecture to work for real: installing Docker (so the client and daemon actually exist on your machine) and drilling the CLI commands that exercise every piece of this model.',
    ],
    keyPoints: [
      'The <code>docker</code> command you type is the <strong>Docker CLI (client)</strong> - it doesn\'t run containers itself, it sends instructions to the <strong>Docker daemon</strong> (<code>dockerd</code>), which does the actual work.',
      'Client and daemon communicate over a REST API and can live on the same machine or different ones - the same <code>docker</code> commands work identically either way.',
      'An <strong>image</strong> is the immutable, layered package (base OS + application + configuration, from lesson 1.2); a <strong>container</strong> is an isolated, running instance of that image (isolated via the namespaces/cgroups from lesson 1.3).',
      'A <strong>registry</strong> (Docker Hub publicly, or a private registry internally) is where images are stored, pulled from with <code>docker pull</code>, and pushed to with <code>docker push</code>.',
      'A single daemon manages containers on one machine; coordinating containers across <strong>many</strong> machines is exactly the job Kubernetes and Docker Swarm exist to do, as covered in the previous lesson.',
    ],
    code: `# The full request path behind a single command:
docker run -d --name web nginx:latest

# 1. The Docker CLI (client) parses the command you typed
# 2. The client sends a request to the Docker daemon (dockerd) over its REST API
# 3. The daemon checks whether the "nginx:latest" image already exists locally
# 4. Not found -> the daemon pulls it, layer by layer, from the registry (Docker Hub)
# 5. The daemon creates an isolated container from the image (namespaces + cgroups)
# 6. The daemon starts the container's process and returns its container ID,
#    which the client prints back to your terminal`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: 'Every Docker concept from this section reduces to one of four pieces - client, daemon, image, or registry - cooperating. Once that model clicks, any new docker subcommand you meet later in the course is just one of those four pieces talking to another.',
      tone: 'accent',
    },
    quiz: {
      question: 'When you run docker pull nginx on your laptop, which two components actually communicate to make that happen?',
      options: [
        { label: 'Your web browser and Docker Hub', correct: false },
        { label: 'The Docker CLI (client) and the Docker daemon', correct: true },
        { label: 'Kubernetes and a kubelet', correct: false },
        { label: 'The container and the host kernel', correct: false },
      ],
      explanation: 'The CLI you type commands into never talks to a registry directly - it sends the request to the Docker daemon over the daemon\'s REST API, and the daemon is the component that actually reaches out to the registry (Docker Hub) to fetch the image. Kubernetes and kubelets are part of container orchestration, a separate layer covered in lesson 1.4, not the local pull path.',
    },
  },
]
