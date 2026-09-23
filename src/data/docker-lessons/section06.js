export default [
  {
    id: '6.1',
    title: 'Why Docker Compose? The Multi-Container Problem',
    duration: '4 min',
    kind: 'concept',
    summary: [
      'Back in lesson 5.2, starting just two containers, MongoDB and mongo-express, already took a dedicated network plus two long docker run commands, each with several flags for ports, environment variables, container names, and the network to join. A real application is rarely just two containers, and every additional one multiplies the number of flags you have to get right, and remember, every time you set the environment up on a new machine.',
      'Docker Compose solves this by letting you describe an entire multi-container setup, every service, its image, its ports, its environment variables, and how it connects to the others, in a single, structured YAML file. Instead of running several long docker run commands in the right order every time, you run one command against that file, and Compose starts, or stops, the entire application stack for you, in the correct order, on a network it manages automatically.',
      'This is not a different technology from what you have already learned, Compose does not introduce new Docker concepts, it is a structured, repeatable way of expressing the exact same docker run configuration you would type by hand. Anything you can pass as a flag to docker run has an equivalent key in a Compose file, and because that file is plain text, it can be committed to your application\'s repository alongside your source code, so the entire team runs the identical setup with one command.',
    ],
    keyPoints: [
      'Every additional container adds more docker run flags to remember and re-type correctly, this gets unmanageable fast as an application grows.',
      '<strong>Docker Compose</strong> describes an entire multi-container application in one YAML file instead of a series of shell commands.',
      'One command starts, or stops, every service defined in the file, in the correct order, instead of running several docker run commands by hand.',
      'Compose does not add new Docker concepts, every key in a Compose file maps to something you already know from docker run.',
      'Because the Compose file is plain text, it can live in your application\'s repository so every teammate runs an identical setup.',
    ],
    code: `# Before: two long, error-prone commands typed by hand every time
docker network create mongo-network

docker run -d -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password --name mongodb --network mongo-network mongo

docker run -d -p 8081:8081 -e ME_CONFIG_MONGODB_ADMINUSERNAME=admin -e ME_CONFIG_MONGODB_ADMINPASSWORD=password -e ME_CONFIG_MONGODB_SERVER=mongodb --network mongo-network --name mongo-express mongo-express

# After: the same setup, described once, started with one command
# (the exact YAML is built step by step in the next lesson)
docker-compose -f mongo.yaml up`,
    codeLabel: 'before (docker run) vs. after (docker compose)',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The value of Compose grows with the size of your application. For two containers it saves you some typing; for ten containers that all need to be wired together correctly, it is the difference between a setup that takes minutes to reproduce and one that takes an error-prone half hour.',
      tone: 'accent',
    },
    quiz: {
      question: 'What problem does Docker Compose primarily solve?',
      options: [
        { label: 'It makes containers start faster than docker run does', correct: false },
        { label: 'It replaces the need for Docker images entirely', correct: false },
        { label: 'It lets you describe and start an entire multi-container application from one structured file instead of multiple manual docker run commands', correct: true },
        { label: 'It removes the need for a Docker network between containers', correct: false },
      ],
      explanation: 'Compose does not make anything run faster or replace images, it is an orchestration convenience: it captures every docker run flag you would otherwise type by hand into one YAML file, and starts, or stops, every defined service with a single command.',
    },
  },
  {
    id: '6.2',
    title: 'Anatomy of docker-compose.yml',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'A Compose file is a YAML document, YAML meaning "YAML Ain\'t Markup Language," a plain-text format that uses indentation instead of brackets to show structure, so indentation is not a style choice, it is meaningful: getting it wrong changes what the file means, or breaks it outright. Every Compose file starts with a <code>version</code> key, identifying which Compose file format the rest of the document follows, and a <code>services</code> key, under which every container you want to run gets its own entry.',
      'Each entry under <code>services</code> is named after the role it plays, <code>mongodb</code> and <code>mongo-express</code> in this example, and that name becomes part of the container\'s name that Compose generates, and the hostname other services use to reach it on the network, more on that in the next lesson. Underneath each service name, <code>image</code> specifies which image to run, exactly like the final argument to <code>docker run</code>; <code>ports</code> takes a list of <code>"host:container"</code> pairs, exactly like repeated <code>-p</code> flags; and <code>environment</code> takes a list of <code>KEY=value</code> entries, exactly like repeated <code>-e</code> flags.',
      'Translating a docker run command you already know into Compose is mostly mechanical: the image name becomes the <code>image</code> key, each <code>-p host:container</code> becomes one line under <code>ports</code>, and each <code>-e KEY=value</code> becomes one line under <code>environment</code>. The one thing to watch closely is the order inside a <code>"host:container"</code> port pair, it is easy to write it backwards. In this example, mongo-express listens on port 8081 <em>inside</em> its container, but the port mapping exposes it on 8080 on the host machine, so the entry reads <code>"8080:8081"</code>, and you would browse to <code>localhost:8080</code>, not 8081, to reach it.',
    ],
    keyPoints: [
      'A Compose file always starts with a <code>version</code> key and a top-level <code>services</code> key.',
      'Each entry under <code>services</code> is named after the role it plays, that name becomes the service\'s hostname on the Compose network.',
      '<code>image</code>, <code>ports</code>, and <code>environment</code> map directly onto the image argument, <code>-p</code> flags, and <code>-e</code> flags of an equivalent <code>docker run</code> command.',
      'Port entries follow the format <code>"host:container"</code>, the same order as <code>-p</code>, double-check which side is which, it is a common source of "why can\'t I reach this" bugs.',
      'YAML uses indentation to express structure; inconsistent indentation is one of the most common reasons a Compose file fails to parse.',
    ],
    code: `version: '3'
services:
  mongodb:
    image: mongo
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
  mongo-express:
    image: mongo-express
    ports:
      - "8080:8081"
    environment:
      - ME_CONFIG_MONGODB_ADMINUSERNAME=admin
      - ME_CONFIG_MONGODB_ADMINPASSWORD=password
      - ME_CONFIG_MONGODB_SERVER=mongodb`,
    codeLabel: 'mongo.yaml',
    note: {
      label: 'WARNING',
      text: 'mongo-express listens on port 8081 inside its own container, that does not change just because you are using Compose. The "8080:8081" mapping above exposes it on port 8080 on your machine; if you write it as "8081:8080" by mistake, or browse to the wrong port, it will look like the service is not running at all.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the ports entry "8080:8081" for the mongo-express service, what does 8081 represent?',
      options: [
        { label: 'The port on your host machine you should browse to', correct: false },
        { label: 'The port mongo-express listens on inside its own container', correct: true },
        { label: 'The port MongoDB listens on', correct: false },
        { label: 'A typo, both numbers should always match', correct: false },
      ],
      explanation: 'A "host:container" port entry always lists the host-side port first and the container-side port second. mongo-express listens on 8081 inside its container regardless of Compose; the "8080" side is simply the port Compose exposes that on, on your machine.',
    },
  },
  {
    id: '6.3',
    title: 'Services, Networks, and depends_on',
    duration: '5 min',
    kind: 'concept',
    summary: [
      'Notice that the Compose file from the previous lesson never mentions a network, and yet mongo-express still reaches MongoDB using the hostname <code>mongodb</code>, exactly like it did in lesson 5.2 after manually creating and attaching both containers to a network. That is because Compose creates a dedicated network for every project automatically, and attaches every service defined in the file to it, with no <code>docker network create</code> or <code>--network</code> flag required. The network\'s name is derived from the project, normally the name of the folder the Compose file lives in, with <code>_default</code> appended, and every service becomes reachable by the other services using its service name as the hostname, exactly as <code>ME_CONFIG_MONGODB_SERVER: mongodb</code> relies on.',
      'Container naming works the same way: Compose prefixes each generated container name with the project name and appends a number, so <code>mongodb</code> in the file might become a running container literally named something like <code>myapp_mongodb_1</code>. You rarely need to type that full generated name, referring to a service by the short name you gave it in the file is enough for most Compose commands.',
      'Running <code>docker-compose up</code> without <code>-d</code> starts every service and streams all of their logs into one terminal at once, each line prefixed with the service name it came from, which is convenient for watching multiple services start up together. This also surfaces a real ordering problem: mongo-express and mongodb both start at roughly the same time, so mongo-express may try to connect before Mongo has finished starting, and you will see connection errors in the logs briefly before it succeeds. The <code>depends_on</code> key addresses the <em>startup order</em> half of this: listing <code>mongodb</code> under mongo-express\'s <code>depends_on</code> tells Compose to start the mongodb container first.',
      'It is important to understand what <code>depends_on</code> does <em>not</em> do: it waits for the MongoDB <em>container process</em> to start, not for the MongoDB <em>database inside it</em> to finish initializing and actually accept connections. Those are different moments in time, a container can be "started" while the application inside is still booting. This is exactly why brief connection-refused messages can still appear in the logs even with <code>depends_on</code> configured; mongo-express\'s own retry logic is what actually gets it connected. Properly waiting for a dependency to be <em>ready</em>, not just started, requires a <code>healthcheck</code>, a more advanced Compose feature covered later in this course.',
    ],
    keyPoints: [
      'Compose automatically creates a project-scoped network and attaches every service to it, no manual <code>docker network create</code> needed.',
      'The auto-created network is typically named <code>&lt;project&gt;_default</code>; running containers are named <code>&lt;project&gt;_&lt;service&gt;_&lt;number&gt;</code>.',
      'Running <code>up</code> without <code>-d</code> streams every service\'s logs into one terminal, prefixed by service name, useful for watching a multi-service startup.',
      '<code>depends_on</code> controls <strong>startup order</strong> only, it starts one container before another, it does not wait for the app inside the first one to be ready.',
      'Waiting for actual readiness, not just "started", requires a <code>healthcheck</code>, a separate, more advanced Compose feature.',
    ],
    code: `version: '3'
services:
  mongodb:
    image: mongo
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
  mongo-express:
    image: mongo-express
    ports:
      - "8080:8081"
    environment:
      - ME_CONFIG_MONGODB_ADMINUSERNAME=admin
      - ME_CONFIG_MONGODB_ADMINPASSWORD=password
      - ME_CONFIG_MONGODB_SERVER=mongodb
    depends_on:
      - mongodb`,
    codeLabel: 'mongo.yaml',
    note: {
      label: 'WARNING',
      text: 'depends_on only guarantees start order, not readiness. A dependency listed under depends_on can still be mid-initialization when the dependent service\'s first connection attempt fires. Design your services to retry on startup, most database client libraries already do, and reach for a healthcheck if you need Compose itself to wait for true readiness.',
      tone: 'accent',
    },
    quiz: {
      question: 'You add depends_on: [mongodb] under the mongo-express service. What does this guarantee?',
      options: [
        { label: 'mongo-express will never see a connection error, because Compose waits for MongoDB to be fully ready to accept connections', correct: false },
        { label: 'Compose will start the mongodb container before starting the mongo-express container, but does not wait for the database inside it to finish initializing', correct: true },
        { label: 'The two containers will be merged into one for networking purposes', correct: false },
        { label: 'MongoDB will automatically restart if mongo-express cannot connect', correct: false },
      ],
      explanation: 'depends_on only sequences container start order. It says nothing about whether the application inside the first container has finished booting and is ready to accept connections, that gap is exactly why brief connection-refused messages can still appear in the logs. True readiness gating requires a healthcheck.',
    },
  },
  {
    id: '6.4',
    title: 'Deploying a Full Application Stack with Compose',
    duration: '7 min',
    kind: 'demo',
    summary: [
      'This lesson brings together everything from the rest of the course so far: the application image built and pushed to a private AWS ECR repository in Section 5 (lessons 5.4–5.6), and the Compose file structure from the previous two lessons, to deploy the <em>complete</em> three-container application, the custom app, MongoDB, and mongo-express, onto a development server using a single Compose file.',
      'The Compose file gains one more service: <code>my-app</code>, whose <code>image</code> is not a short Docker Hub name but the full private-registry path built in lesson 5.5, <code>&lt;registry-domain&gt;/my-app:1.0</code>, with port 3000, the port the Node.js server listens on, mapped through to the host. Before running <code>docker-compose up</code> on the development server, that server has to run <code>docker login</code> against the ECR registry first, exactly as covered in lesson 5.6, Compose has no special ability to authenticate to a private registry on its own; it simply calls the same <code>docker pull</code> machinery that requires you to already be logged in. The two public images, <code>mongo</code> and <code>mongo-express</code>, need no such login, since Docker Hub allows anonymous pulls.',
      'The one code change that makes this all work is in the application itself: earlier, running directly on a developer\'s laptop, its MongoDB connection string used <code>localhost:27017</code>, because the app was not a container on the same Docker network as MongoDB. Now that <code>my-app</code> is itself a service inside this Compose file, it is on the same auto-created network as <code>mongodb</code>, so the connection string changes to use the hostname <code>mongodb</code> instead of <code>localhost</code>, exactly the container-to-container addressing rule from lesson 5.2, just now applying to your own application instead of only to mongo-express.',
      'Running <code>docker-compose -f mongo.yaml up</code> starts all three containers together: the app comes up listening on port 3000, MongoDB starts and begins waiting for connections, and mongo-express connects to it, all visible as interleaved log output in one terminal. Browsing to the app\'s port confirms it is reachable and working end to end, pulled entirely from registries, with nothing installed by hand on the server. As in the earlier Compose lessons, there is still no data persistence configured, so a restart of the stack will lose whatever was stored in MongoDB; Docker volumes, covered later in this course, solve that.',
    ],
    keyPoints: [
      'Add your own application as another service in the Compose file, using the full private-registry image path from lesson 5.5, not a short Docker Hub-style name.',
      'Run <code>docker login</code> against the private registry <strong>before</strong> <code>docker-compose up</code>, Compose does not authenticate to private registries on its own.',
      'Public images, <code>mongo</code> and <code>mongo-express</code>, still pull anonymously, only the private <code>my-app</code> image needs the login step.',
      'Once your own application becomes a Compose service, it must address other services, like MongoDB, by service name, not <code>localhost</code>, the exact same rule covered in lesson 5.2.',
      'Without volumes, restarting this stack still discards MongoDB\'s data, that gap is closed in a later section covering Docker volumes.',
    ],
    code: `# mongo.yaml — full three-service application stack
version: '3'
services:
  my-app:
    image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:1.0
    ports:
      - "3000:3000"
  mongodb:
    image: mongo
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
  mongo-express:
    image: mongo-express
    ports:
      - "8080:8081"
    environment:
      - ME_CONFIG_MONGODB_ADMINUSERNAME=admin
      - ME_CONFIG_MONGODB_ADMINPASSWORD=password
      - ME_CONFIG_MONGODB_SERVER=mongodb
    depends_on:
      - mongodb

# --- On the development server, before deploying ---

# 1. Authenticate to the private registry (needed for my-app, not for mongo/mongo-express)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# 2. Start the whole stack from the Compose file
docker-compose -f mongo.yaml up
# my-app_1        | Server running on port 3000
# mongodb_1       | Waiting for connections on port 27017
# mongo-express_1 | Mongo Express server listening on port 8081`,
    codeLabel: 'mongo.yaml + terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The connection string change from localhost to mongodb is small, but it is the clearest proof that your own application is now playing by the same container-networking rules as everything else on the stack. Any service on a Compose network, whether it is a well-known database image or code you wrote yourself, addresses its neighbors by service name.',
      tone: 'accent',
    },
    quiz: {
      question: 'The application\'s MongoDB connection string changes from localhost:27017, when running on a developer\'s laptop, to mongodb:27017 in this lesson\'s Compose deployment. Why?',
      options: [
        { label: 'mongodb is a special DNS name Docker always resolves to the nearest database container', correct: false },
        { label: 'Port 27017 only works with the hostname mongodb, never with localhost', correct: false },
        { label: 'Once my-app itself becomes a Compose service, it shares the same auto-created network as the mongodb service and must address it by service name, the same rule that applied to mongo-express in Section 5', correct: true },
        { label: 'localhost stopped working after the image was pushed to a private registry', correct: false },
      ],
      explanation: 'localhost only works when a process is not itself inside the Docker network its dependency is on, which was true while the app ran directly on a developer\'s machine. Once the app is packaged and run as a Compose service, it joins the same network as mongodb and mongo-express, and must use the service name mongodb to reach the database, exactly the rule introduced in lesson 5.2.',
    },
  },
  {
    id: '6.5',
    title: 'Docker Compose Command Reference',
    duration: '4 min',
    kind: 'summary',
    summary: [
      'This lesson consolidates every Compose command used across this section into one reference, plus a handful of standard companion commands you will reach for constantly once you are working with multi-container applications day to day. Every command below assumes you are in the same directory as your Compose file, or that you pass its path explicitly with <code>-f &lt;filename&gt;</code>, exactly as <code>-f mongo.yaml</code> was used throughout this section.',
      'One naming note worth clearing up: this section, following the source material, uses the hyphenated <code>docker-compose</code> command, a separate, standalone tool you install alongside Docker. Modern Docker installations also ship <code>docker compose</code>, two words, no hyphen, built directly into the Docker CLI as a plugin. They accept the same subcommands and the same Compose file format; the space-separated form is the current standard going forward, but you will still encounter the hyphenated form in plenty of existing tutorials, scripts, and CI pipelines, so it is worth recognizing both.',
      'Beyond <code>up</code> and <code>down</code>, which this section already covered, <code>ps</code> lists the containers a Compose project has running, scoped to just that project rather than every container on the machine; <code>logs</code> and <code>logs -f &lt;service&gt;</code> retrieve or stream a single service\'s logs, the Compose-aware equivalent of <code>docker logs</code>; and <code>exec &lt;service&gt; &lt;command&gt;</code> runs a command inside an already-running service\'s container, most often used to open an interactive shell for troubleshooting.',
    ],
    keyPoints: [
      'Use <code>-f &lt;filename&gt;</code> to point any Compose command at a specific file, needed whenever it is not named the default <code>docker-compose.yml</code>.',
      '<code>docker-compose up</code>, hyphenated, and <code>docker compose up</code>, space-separated and built into modern Docker, accept the same subcommands, the space-separated form is the current standard.',
      '<code>docker-compose down</code> stops and removes every container <strong>and</strong> the auto-created network for that project, that is why the network has to be recreated on the next <code>up</code>.',
      '<code>docker-compose ps</code> and <code>docker-compose logs -f &lt;service&gt;</code> scope their output to just the current project, unlike plain <code>docker ps</code> / <code>docker logs</code>, which show everything on the machine.',
      '<code>docker-compose exec &lt;service&gt; sh</code> opens a shell inside a running service\'s container, useful for poking around or checking a file without leaving the terminal.',
    ],
    code: `# Start every service defined in the file (foreground, streams logs)
docker-compose -f mongo.yaml up

# Start in the background (detached) instead
docker-compose -f mongo.yaml up -d

# Stop and remove every container AND the project's auto-created network
docker-compose -f mongo.yaml down

# ...also remove any named volumes (careful: this deletes persisted data)
docker-compose -f mongo.yaml down -v

# List only this project's running containers
docker-compose -f mongo.yaml ps

# View one service's logs
docker-compose -f mongo.yaml logs mongodb

# Stream one service's logs live (like docker logs -f)
docker-compose -f mongo.yaml logs -f mongodb

# Open a shell inside a running service's container
docker-compose -f mongo.yaml exec mongodb sh

# Rebuild images for any service that defines a "build:" key
docker-compose -f mongo.yaml build

# Modern Docker ships the same functionality as a CLI plugin (no hyphen):
docker compose -f mongo.yaml up -d`,
    codeLabel: 'terminal — docker compose command reference',
    note: {
      label: 'KEY INSIGHT',
      text: 'Almost every Compose command has a direct docker equivalent, logs, ps, exec, scoped down from plain Docker. The difference is that the Compose version automatically filters to just the containers defined in your file, instead of everything running on the machine.',
      tone: 'accent',
    },
    quiz: {
      question: 'You want to watch only the mongodb service\'s logs update live, without stopping the rest of the stack or seeing log lines from the other services. Which command does that?',
      options: [
        { label: 'docker-compose -f mongo.yaml down', correct: false },
        { label: 'docker-compose -f mongo.yaml logs -f mongodb', correct: true },
        { label: 'docker-compose -f mongo.yaml ps mongodb', correct: false },
        { label: 'docker-compose -f mongo.yaml exec mongodb logs', correct: false },
      ],
      explanation: 'logs -f <service> streams that one service\'s log output live, scoped to just that container, without touching the rest of the stack. down would stop everything, ps only lists container status rather than log content, and exec runs a command inside the container rather than reading its logs.',
    },
  },
]
