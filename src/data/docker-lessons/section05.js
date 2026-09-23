export default [
  {
    id: '5.1',
    title: 'The Docker Development Workflow: Code → Build → Ship → Run',
    duration: '5 min',
    kind: 'concept',
    summary: [
      'Once you know Docker\'s basic commands and concepts, such as images, containers, and <code>docker run</code>, the next step is seeing how Docker fits into an actual software delivery process. Every team follows some version of the same loop: a developer writes code locally, commits it to a version control system like Git, an automated build server picks up the change and produces a deployable artifact, and that artifact eventually lands on a server where a tester or another developer can try it out. Docker plugs into every stage of that loop, but in a different role each time. This lesson walks through the whole loop once, at a high level, so the individual pieces covered later in this section (development workflow, private registries, and Docker Compose) have a map to fit into.',
      'Consider a concrete example: you are building a JavaScript application on your laptop, and that application needs a MongoDB database. Instead of installing MongoDB directly on your machine, with all the setup and version conflicts that implies, you pull a MongoDB image from <strong>Docker Hub</strong>, a public registry of ready-to-run images, and start it as a container. Your application, running locally, connects to that containerized database. This is the same pattern you will practice hands-on in the next two lessons: use a container for anything your app depends on, so your laptop stays clean and your setup is reproducible for every developer on the team.',
      'Once the first version of the application works locally, the next step is sharing it. You commit your code to Git, which triggers a continuous integration (CI) build, commonly run by a tool like Jenkins. The CI server does two things: it builds your JavaScript application into a deployable artifact, and then it builds a <strong>Docker image</strong> out of that artifact using a Dockerfile. The image is not the source code itself, it is a self-contained, runnable package: your compiled application plus the exact runtime and dependencies it needs. That image is the unit that moves through every later stage of the pipeline.',
      'The image produced by the CI build gets pushed to a <strong>private Docker repository</strong>, not the public Docker Hub. Companies keep their own application images private because they contain proprietary code; only generic, non-sensitive dependencies, like the official MongoDB image, come from a public registry. Lessons 5.4 through 5.6 in this section cover exactly how private repositories work and how to push to one. Once the image is sitting in the private repository, a Jenkins job, or a deployment script, tells the target development server to pull it down, alongside the public MongoDB image from Docker Hub. The dev server ends up running the exact same two-container pattern you built locally: your custom application container and the MongoDB container, talking to each other. A tester or another developer can then log into that dev server and try the application, without ever installing anything by hand.',
    ],
    keyPoints: [
      'The same two-container pattern (your app + its dependencies) repeats at every stage: laptop, CI build, and dev server — only where the containers run changes.',
      'A <strong>CI server</strong> like Jenkins builds your application artifact, then packages it into a <strong>Docker image</strong> using a Dockerfile.',
      'Application images are pushed to a <strong>private repository</strong> because they contain proprietary code; public, generic dependencies (like <code>mongo</code>) are pulled straight from Docker Hub.',
      'The target server (dev, test, or production) pulls your custom image from the private repository and any public dependency images from Docker Hub, then runs them together.',
      'This lesson is the map for the rest of the section: local development with containers (5.2–5.3), private registries (5.4–5.6), and later, Docker Compose (Section 6) to automate the "run them together" step.',
    ],
    code: `Local laptop
  |
  |  1. Write JavaScript app, run it against a MongoDB container
  |     docker pull mongo
  |     docker run -d -p 27017:27017 --name mongodb mongo
  v
Git commit / push
  |
  |  2. Triggers a CI build (e.g. Jenkins)
  v
CI server (Jenkins)
  |
  |  3. Build the application artifact
  |  4. docker build -t my-app:1.0 .
  |  5. docker push <private-registry-domain>/my-app:1.0
  v
Private Docker repository
  |
  |  6. Development server pulls the new image
  |     docker pull <private-registry-domain>/my-app:1.0
  |     docker pull mongo   (public image, straight from Docker Hub)
  v
Development server
  - my-app container   (pulled from the private repository)
  - mongodb container  (pulled from Docker Hub)
  these two containers run side by side and talk to each other,
  exactly like they did on your laptop`,
    codeLabel: 'the path from laptop to dev server',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Docker does not change what your application does, it changes how consistently it runs. The exact same container image that worked on your laptop is what gets tested on the dev server and, eventually, run in production, eliminating the classic "it worked on my machine" problem.',
      tone: 'accent',
    },
    quiz: {
      question: 'In the workflow described in this lesson, why is the MongoDB image pulled straight from Docker Hub on the development server, while the application image is pulled from a private repository?',
      options: [
        { label: 'MongoDB images are smaller and load faster from Docker Hub', correct: false },
        { label: 'MongoDB is a generic, publicly available dependency with no proprietary code, while the application image contains the company\'s own code and must stay private', correct: true },
        { label: 'Docker Hub does not support private images at all', correct: false },
        { label: 'Private repositories cannot host database images, only application images', correct: false },
      ],
      explanation: 'Docker Hub is fine for well-known, public dependencies like the official MongoDB image, there is nothing proprietary about it. Your own application, however, contains code you do not want publicly accessible, so it is built and pushed to a private repository that only your team and your servers can pull from.',
    },
  },
  {
    id: '5.2',
    title: 'Local Development Setup: Docker Networks for Multi-Container Apps',
    duration: '7 min',
    kind: 'demo',
    summary: [
      'This lesson picks up the local-development half of the workflow from the previous lesson: running the dependencies your application needs as containers, instead of installing them on your machine. The example is a small JavaScript and Node.js application, a single-page user profile form, that needs a MongoDB database. Rather than typing raw MongoDB shell commands to inspect the database, this lesson also brings in <code>mongo-express</code>, a web-based MongoDB admin UI that itself ships as a Docker image, so the whole database layer can be inspected from a browser instead of a terminal.',
      'Before running anything, the two containers need a way to talk to each other. Docker\'s default behavior isolates containers from one another unless you explicitly connect them, and the mechanism for that is a <strong>Docker network</strong>: an isolated virtual network that Docker manages, where containers placed on the same network can reach each other <em>by container name</em>, without needing a host, port, or IP address. Containers that are <em>not</em> on that network, including anything running directly on your laptop outside Docker, have to reach a container the normal way: through <code>localhost</code> and whatever port that container published to the host. Run <code>docker network ls</code> and you will see Docker already ships with a handful of default networks; rather than reuse one of those, this lesson creates a dedicated network just for this application\'s containers, which keeps things predictable and easy to tear down later.',
      'With the network in place, both containers are started with <code>docker run</code>, each pinned to that network with the <code>--network</code> flag, each given an explicit <code>--name</code> (which becomes the hostname other containers on the network use to reach it), and each configured with the environment variables their official images expect: <code>mongo</code> takes a root username and password via <code>MONGO_INITDB_ROOT_USERNAME</code> and <code>MONGO_INITDB_ROOT_PASSWORD</code>, and <code>mongo-express</code> takes matching admin credentials plus <code>ME_CONFIG_MONGODB_SERVER</code>, the hostname of the Mongo container it should connect to. Because both containers sit on the same custom network, that value is simply the container name, <code>mongodb</code>, not an IP address or <code>localhost</code>.',
      'These environment variables are not guesswork, they come straight from each image\'s documentation on Docker Hub. Every well-maintained official image documents the environment variables it reads on startup; checking that documentation before writing your <code>docker run</code> command, instead of copying a command from an old blog post, is a habit worth building early, since it tells you exactly what a container needs to be configured correctly.',
    ],
    keyPoints: [
      'A <strong>Docker network</strong> lets containers on it reach each other by container name alone, no host, port, or IP address needed.',
      'Containers outside the network, including apps running directly on your machine, must still use <code>localhost</code> and the container\'s published port.',
      'Create a dedicated network with <code>docker network create &lt;name&gt;</code>, then attach each container to it with <code>--network &lt;name&gt;</code>.',
      'The <code>--name</code> you give a container becomes its hostname on that network, so <code>mongo-express</code> reaches Mongo using the hostname <code>mongodb</code>.',
      'Always check an official image\'s Docker Hub page for the environment variables it supports before writing a <code>docker run</code> command from scratch.',
    ],
    code: `# 1. Create a dedicated network for this app's containers
docker network create mongo-network

# 2. Confirm it exists
docker network ls

# 3. Start MongoDB on that network
docker run -d -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password --name mongodb --network mongo-network mongo

# 4. Start mongo-express on the same network, pointed at the mongodb container
docker run -d -p 8081:8081 -e ME_CONFIG_MONGODB_ADMINUSERNAME=admin -e ME_CONFIG_MONGODB_ADMINPASSWORD=password -e ME_CONFIG_MONGODB_SERVER=mongodb --network mongo-network --name mongo-express mongo-express`,
    codeLabel: 'terminal',
    note: {
      label: 'WARNING',
      text: 'Containers only get automatic name-based DNS resolution on a user-defined network like the one created here. Containers left on Docker\'s default bridge network cannot reliably reach each other by name, only by IP address, which changes every time a container restarts. Always create a custom network for multi-container apps.',
      tone: 'accent',
    },
    quiz: {
      question: 'The mongo-express container is configured with ME_CONFIG_MONGODB_SERVER=mongodb. Why does that work, instead of needing the MongoDB container\'s IP address?',
      options: [
        { label: 'mongo-express automatically discovers every running container on the machine', correct: false },
        { label: 'Both containers are attached to the same custom Docker network, which lets them resolve each other by container name', correct: true },
        { label: '"mongodb" is a reserved DNS name that always points to the first container Docker starts', correct: false },
        { label: 'MONGO_INITDB_ROOT_USERNAME grants network-level access between containers', correct: false },
      ],
      explanation: 'Docker\'s user-defined networks include an internal DNS service: any container on the network can reach another by using its --name as the hostname. That is why ME_CONFIG_MONGODB_SERVER can simply be "mongodb" instead of an IP address, which would be fragile and change on every restart.',
    },
  },
  {
    id: '5.3',
    title: 'Connecting Your App to Containers and Debugging with docker logs',
    duration: '6 min',
    kind: 'demo',
    summary: [
      'With MongoDB and mongo-express running from the previous lesson, the next step is connecting the actual Node.js application to the database. Unlike the two containers, the Node.js app in this lesson runs directly on the host machine, outside Docker, to simulate a typical local development loop where you edit code and see changes instantly, without rebuilding an image every time. Because the app is not on the <code>mongo-network</code> created earlier, it cannot reach MongoDB by the container name; it has to connect the same way anything outside Docker does, through <code>localhost</code> and the port MongoDB published to the host.',
      'The Node.js code uses a MongoDB client library to build a connection string out of four pieces: the protocol, the host and port (<code>localhost:27017</code>, since the container published port 27017 to the host), and the username and password configured when the container started (<code>admin</code> / <code>password</code>). In a real application you would never connect using the database\'s root credentials or hardcode a password directly in source code, you would create a dedicated application user and load the password from an environment variable or a secrets manager, but for a local demo, connecting directly keeps the example focused on the Docker mechanics rather than credential management.',
      'Testing the connection is done two ways at once: through the app\'s own UI, editing the profile form and saving, which triggers the Node.js backend to insert or update a document in a <code>users</code> collection inside a <code>user-account-database</code> database; and through the <code>mongo-express</code> web UI, refreshing the collection to see that same document appear. Seeing the identical data show up in both places confirms the whole chain, browser to Node.js to MongoDB container, is wired correctly.',
      'When something does not behave as expected, <code>docker logs</code> is the first tool to reach for. <code>docker logs &lt;container&gt;</code> prints everything a container has written to its console since it started; <code>docker logs --tail 20 &lt;container&gt;</code> limits that to the most recent lines, useful when a long-running container has produced a huge log history; and <code>docker logs -f &lt;container&gt;</code> follows the log in real time, similar to <code>tail -f</code> on a regular file, so you can watch new connections and queries arrive as you interact with the application.',
    ],
    keyPoints: [
      'An app running directly on the host, outside Docker, connects to a container through <code>localhost</code> and the container\'s <strong>published</strong> port, not the container name.',
      'Only containers that share a custom Docker network can address each other by name, as covered in the previous lesson.',
      'Never hardcode root database credentials in application source code outside of a local demo, use a dedicated application user and load secrets from the environment.',
      '<code>docker logs &lt;container&gt;</code> shows everything a container has printed; add <code>--tail N</code> to see only the last N lines, or <code>-f</code> to stream new output live.',
      'Verifying a fix in two places at once, the app\'s own UI and an admin tool like mongo-express, is a fast way to confirm an integration end to end.',
    ],
    code: `// db.js — connecting Node.js (running on the host) to the MongoDB container
const { MongoClient } = require('mongodb');

const username = 'admin';
const password = 'password'; // demo only — never hardcode credentials in real code
const uri = 'mongodb://' + username + ':' + password + '@localhost:27017';

const client = new MongoClient(uri);

async function getUsersCollection() {
  await client.connect();
  const db = client.db('user-account-database');
  return db.collection('users');
}

module.exports = { getUsersCollection };

// --- Debugging with docker logs, from a separate terminal ---
// docker ps                       find the container name or ID
// docker logs mongodb             print the full log history
// docker logs --tail 20 mongodb   print only the last 20 lines
// docker logs -f mongodb          stream new log output live (Ctrl+C to stop)`,
    codeLabel: 'db.js + terminal (docker logs)',
    note: {
      label: 'WARNING',
      text: 'Connecting with the database\'s root username and password directly from application code is only acceptable for a local demo like this one. In any real environment, create a dedicated, least-privilege database user for the application and load its credentials from environment variables or a secrets manager, never from a literal string in source code.',
      tone: 'accent',
    },
    quiz: {
      question: 'The Node.js application in this lesson runs directly on your laptop, not inside a container. Why does its MongoDB connection string use localhost:27017 instead of the container name mongodb?',
      options: [
        { label: 'localhost and the container name are interchangeable in every situation', correct: false },
        { label: 'The Node.js process is not on the custom Docker network the containers share, so it must reach MongoDB the way anything outside Docker does: via localhost and the port published to the host', correct: true },
        { label: 'MongoDB containers only accept connections from localhost, never from other containers', correct: false },
        { label: 'The mongo-network created earlier automatically includes every process on the host machine', correct: false },
      ],
      explanation: 'Name-based resolution, like mongodb, only works between containers that are attached to the same custom Docker network. A process running on the host itself, outside any container, was never placed on that network, so it has to connect the traditional way: localhost plus the port the container published with -p.',
    },
  },
  {
    id: '5.4',
    title: 'What Is a Container Registry? Docker Hub vs. Private Registries',
    duration: '5 min',
    kind: 'concept',
    summary: [
      'Every image you have used so far, <code>mongo</code>, <code>mongo-express</code>, has been pulled from Docker Hub, a free public <strong>registry</strong>: a server that stores Docker images and serves them on request. Docker Hub is the default registry Docker talks to when you don\'t specify one, which is why <code>docker pull mongo</code> works without any extra configuration. Once you start building and shipping your own application images as part of a real workflow, as described in lesson 5.1, you need somewhere to store <em>those</em> images too, and for most companies, that somewhere cannot be a public registry.',
      'A <strong>private registry</strong> works the same way as Docker Hub conceptually, images live in named repositories, each repository can hold multiple tagged versions of the same image, but access is restricted to people and systems with valid credentials. Popular options include AWS Elastic Container Registry (ECR), Nexus, DigitalOcean\'s container registry, and self-hosted registries, and this lesson, along with the two that follow, uses AWS ECR as the concrete example, since it is one of the most common choices for teams already running infrastructure on AWS.',
      'The one operation that is fundamentally different with a private registry is authentication: before you can push an image to it, or pull one from it, you have to prove you have access. That is what <code>docker login</code> is for. You never had to run it against Docker Hub in this course so far because every image pulled was public; the moment a repository is private, whatever machine is pushing or pulling, your laptop, a Jenkins build agent, or a development server, has to authenticate first. The next lesson covers exactly how image names change once a registry is private, and the lesson after that walks through the full login-and-push workflow.',
    ],
    keyPoints: [
      'A <strong>registry</strong> is a server that stores and serves Docker images; Docker Hub is the default, public registry Docker uses when none is specified.',
      'A <strong>private registry</strong> behaves the same way but restricts access to authenticated users and systems, keeping proprietary application images out of public view.',
      'Common private registry options include AWS ECR, Nexus, DigitalOcean, and self-hosted registries.',
      '<code>docker login</code> is required before pushing to or pulling from a private registry, unlike public Docker Hub images, which pull anonymously.',
      'Whatever pulls a private image, a laptop, a CI server, or a production host, must authenticate first; there is no shortcut around this.',
    ],
    code: `Docker Hub (public)                   Private Registry (e.g. AWS ECR)
------------------------------        ------------------------------
docker pull mongo                     docker login <registry-domain>
  -> no login required                  (required once, before push/pull)
                                       docker pull <registry-domain>/my-app:1.0
Anyone can pull                       Only authenticated users/systems can pull
Good for: public, generic images      Good for: your own application images`,
    codeLabel: 'docker hub vs. a private registry',
    note: {
      label: 'KEY INSIGHT',
      text: 'The technical mechanics of pushing and pulling images are identical between Docker Hub and a private registry. The only meaningful difference is the authentication step, docker login, which a public registry never requires and a private one always does.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why has docker login never been necessary in this course until now, even though you have already pulled several images?',
      options: [
        { label: 'docker login is only needed for pushing images, never for pulling', correct: false },
        { label: 'Every image pulled so far (mongo, mongo-express) came from the public Docker Hub, which allows anonymous pulls; private registries require authentication for both push and pull', correct: true },
        { label: 'docker login was run automatically in the background by Docker Desktop', correct: false },
        { label: 'Only images larger than 1 GB require authentication', correct: false },
      ],
      explanation: 'Public repositories on Docker Hub can be pulled by anyone without credentials. The moment an image lives in a private registry, whether you are pushing a new version or pulling an existing one, you must authenticate first with docker login, or an equivalent, registry-specific login command.',
    },
  },
  {
    id: '5.5',
    title: 'Image Naming and Tagging for a Private Registry',
    duration: '5 min',
    kind: 'concept',
    summary: [
      'To push an image anywhere other than Docker Hub, Docker needs more information encoded directly in the image\'s name. The full, unabbreviated format for any image name is <code>registry-domain/repository-name:tag</code>. The registry domain identifies which server to talk to, its hostname and optionally a port; the repository name identifies which image within that registry; and the tag identifies which version. When you run <code>docker pull mongo:4.2</code>, you are actually using a shorthand: Docker fills in the missing pieces and executes <code>docker pull docker.io/library/mongo:4.2</code> behind the scenes. <code>docker.io</code> is Docker Hub\'s registry domain, and <code>library</code> is the namespace Docker Hub uses for its official images, both are assumed automatically, which is why you never had to type them.',
      'A private registry has no such default to fall back on, there is no assumed domain, so the full name must be spelled out every time. AWS ECR generates this domain for you automatically, in the form <code>&lt;aws-account-id&gt;.dkr.ecr.&lt;region&gt;.amazonaws.com</code>, and each ECR repository is scoped to a single application image: you create one repository, for example <code>my-app</code>, and every version of that one image is stored inside it as a different tag. This is a slightly different mental model from some other registries, where a single repository might hold several unrelated images; in ECR, one image, one repository, many tags.',
      'This is where <code>docker tag</code> comes in. If you have already built an image locally as <code>my-app:1.0</code>, running <code>docker push my-app</code> as-is would fail, or worse, silently try to push to Docker Hub, since Docker assumes Docker Hub whenever a registry domain is missing. <code>docker tag</code> does not rebuild or copy the image\'s contents; it simply creates a second name pointing at the exact same image, running <code>docker images</code> afterward shows two entries with different names but the identical image ID. The command takes the existing local name first, then the new, fully-qualified name that includes the registry domain: <code>docker tag my-app:1.0 &lt;registry-domain&gt;/my-app:1.0</code>. Only after that retagging does <code>docker push</code> know exactly which registry and repository to send the image to.',
    ],
    keyPoints: [
      'The full image name format is <code>registry-domain/repository-name:tag</code>; Docker Hub pulls omit the domain because <code>docker.io/library/</code> is assumed by default.',
      'A private registry has no default domain, the full name must always be spelled out, including the domain.',
      'AWS ECR generates a registry domain per account and region: <code>&lt;account-id&gt;.dkr.ecr.&lt;region&gt;.amazonaws.com</code>.',
      'In ECR, each repository holds one image and all of its tagged versions, up to 1,000 tags per repository.',
      '<code>docker tag &lt;existing-name&gt; &lt;new-name&gt;</code> creates a second name for the same image, it does not rebuild or copy anything, which is why it runs instantly.',
    ],
    code: `# The full, unabbreviated form of an image name:
#   registry-domain/repository-name:tag

# This familiar shorthand...
docker pull mongo:4.2

# ...is really this, with Docker Hub's domain and namespace filled in automatically:
docker pull docker.io/library/mongo:4.2

# A private registry (AWS ECR) has no default domain, so it must be spelled out.
# First, retag the image you already built locally:
docker tag my-app:1.0 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:1.0

# Confirm both names now point at the same image ID:
docker images
# REPOSITORY                                                    TAG    IMAGE ID
# my-app                                                        1.0    a1b2c3d4e5f6
# 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app           1.0    a1b2c3d4e5f6`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: 'docker tag is a metadata operation, not a build step. It adds a new name to an image that already exists locally; the underlying layers are not touched or duplicated. This is why you always tag right after building, before pushing, rather than rebuilding the image with a different name.',
      tone: 'accent',
    },
    quiz: {
      question: 'You already built an image locally as my-app:1.0. What does running docker tag my-app:1.0 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:1.0 actually do?',
      options: [
        { label: 'It rebuilds the image from the Dockerfile using the new name', correct: false },
        { label: 'It creates a copy of the image\'s layers under a new, fully-qualified name', correct: false },
        { label: 'It adds a second name pointing at the same existing image, with no rebuilding or copying of layers', correct: true },
        { label: 'It uploads the image to AWS ECR immediately', correct: false },
      ],
      explanation: 'docker tag only manipulates the image\'s metadata: it adds a new name, here, one for AWS ECR, to an already-built image. docker images afterward shows two repository names sharing the same image ID. The actual upload only happens on the following docker push.',
    },
  },
  {
    id: '5.6',
    title: 'Pushing Images to a Private Registry on AWS (ECR)',
    duration: '7 min',
    kind: 'demo',
    summary: [
      'With the naming and tagging concepts from the previous lesson in place, this lesson runs through the complete push workflow against a real AWS ECR repository, from creating the repository through pushing a second version of the image. In the AWS Console, creating a repository is a matter of opening the Elastic Container Registry (ECR) service, clicking "Get Started" (or "Create repository"), and giving it a name that matches your image, <code>my-app</code> in this example. The repository starts empty; every version you push afterward shows up inside it as a separate tag.',
      'Before anything can be pushed, the local machine, whether that is your laptop or a Jenkins build agent, has to authenticate to the registry with <code>docker login</code>. AWS provides its own CLI helper for this because ECR login tokens are temporary and generated through the AWS CLI rather than a fixed password; the command retrieves a short-lived token and pipes it into <code>docker login</code> for you. This requires the AWS CLI to be installed and configured with valid credentials beforehand. The important thing to remember is that this login step only needs to run <strong>once</strong> per session, not before every single push or pull that follows.',
      'With authentication done, the push itself is two commands: <code>docker tag</code>, exactly as covered in the previous lesson, followed by <code>docker push &lt;full-registry-path&gt;:&lt;tag&gt;</code>. Docker pushes an image\'s layers one at a time, the same way it pulls them layer by layer, so the console output shows each layer being uploaded individually. Once the push finishes, refreshing the repository in the AWS Console shows the new tag, along with the image\'s digest, a unique cryptographic hash identifying its exact contents, and its full image URI.',
      'The real value of this workflow shows up on the second push. After making a change, editing the Dockerfile or the application code, rebuilding the image as a new version with <code>docker build -t my-app:1.1 .</code>, and tagging and pushing it the same way, only the layers that actually changed get uploaded; any layer that already exists in the registry from the previous push is skipped. This is the same layer-based caching that makes <code>docker build</code> fast locally, extended to the push itself. A single ECR repository can hold up to 1,000 tags, so a team can keep a long history of versions to roll back to if needed.',
    ],
    keyPoints: [
      'Create one AWS ECR repository per application image, for example <code>my-app</code>; every version you push lives inside it as a separate tag.',
      '<code>docker login</code>, via the AWS CLI helper, must run once, before your first push or pull in a session, not before every single command.',
      'The push sequence is always: build the image, <code>docker tag</code> it with the full registry path, then <code>docker push</code> that full path.',
      'Docker pushes an image layer by layer; on later pushes, only layers that changed since the last push are actually uploaded.',
      'AWS ECR shows each pushed tag\'s digest, a unique hash of its contents, and full image URI in the console, useful for confirming exactly what was deployed.',
    ],
    code: `# 1. Authenticate to AWS ECR (run once per session)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# 2. Tag the image you already built locally with the full ECR path
docker tag my-app:1.0 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:1.0

# 3. Push it
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:1.0
# The push refers to repository [123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app]
# 5f70bf18a086: Pushed
# 9f54eef41275: Pushed
# 1.0: digest: sha256:3b2b8bfa1c9d... size: 1364

# --- Later: a new version of the app is ready ---

# 4. Rebuild with a new tag
docker build -t my-app:1.1 .

# 5. Tag and push the new version (same repository, new tag)
docker tag my-app:1.1 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:1.1
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:1.1
# Only the layers that changed since 1.0 are actually uploaded;
# unchanged layers are detected as already present and skipped.`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'docker login only needs to run once per session, not once per push. If you find yourself re-running it before every docker push, something else is likely wrong, an expired token, or a typo in the registry domain, not a missing login step.',
      tone: 'accent',
    },
    quiz: {
      question: 'You ran docker login against your ECR registry an hour ago and pushed my-app:1.0 successfully. You now have a new version ready as my-app:1.1. What do you need to do before docker push will succeed?',
      options: [
        { label: 'Run docker login again, it is required before every single push', correct: false },
        { label: 'Tag the new image with the full registry path, then push that path, your existing login session is still valid', correct: true },
        { label: 'Create a brand-new ECR repository for version 1.1', correct: false },
        { label: 'Delete the 1.0 tag before pushing 1.1', correct: false },
      ],
      explanation: 'A docker login session stays valid until its token expires, it is not a one-time-use credential. As long as that session is still active, you only need to tag the new image with the full registry path and push it, you do not need to log in again or create a new repository for a new version.',
    },
  },
]
