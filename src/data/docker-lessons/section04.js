export default [
  {
    id: '4.1',
    title: "What's Inside an Image? Layers Explained",
    duration: '6 min',
    kind: 'theory',
    summary: [
      'A Docker image is not one big file — it is a stack of read-only <strong>layers</strong> plus a small amount of metadata (which command to run, which ports are documented, which environment variables are set). Every instruction in a Dockerfile that changes the filesystem — <code>FROM</code>, <code>RUN</code>, <code>COPY</code>, <code>ADD</code> — produces one new layer, which is really just a recorded set of file additions, changes, and deletions relative to the layer below it. Docker\'s storage driver (typically <code>overlay2</code> on Linux) uses a union filesystem to stack all of an image\'s layers on top of each other and present them as a single, ordinary-looking filesystem inside the container — even though on disk they remain separate, independent pieces.',
      'This stacking is exactly what you saw in the previous section\'s image-building example: a <code>node:13-alpine</code> image is not a standalone thing — it is built <code>FROM alpine:3.10</code>, with additional layers on top that install the Node.js runtime. When you then write <code>FROM node:13-alpine</code> in your own Dockerfile, your application\'s layer sits on top of all of those, without needing to know or care what is underneath. Each layer is immutable once built and is identified by a content hash, so Docker never has to guess whether a layer changed — it either matches exactly or it doesn\'t.',
      'The practical payoff of this design is layer <strong>sharing</strong>. If you pull <code>node:20-alpine</code> for one project and <code>python:3.12-alpine</code> for another, and both happen to be built on the exact same underlying Alpine base layer, Docker stores that shared layer on disk exactly once and reuses it for both images — it does not download or store it twice. This is also why a second <code>docker pull</code> or <code>docker build</code> involving an image you already have layers of is often dramatically faster: Docker only needs to fetch or rebuild the layers that are actually new or changed, not the whole image from scratch.',
      'Layers only tell half the story, though — they describe the read-only image. The moment you run a container from an image, Docker adds one more layer on top: a thin, writable "container layer" unique to that specific container. Every file a running container creates or modifies (which is exactly what you did with <code>docker exec</code> in the previous lesson) lands in that writable layer, not in the underlying image. That is precisely why those changes disappear when the container is removed — the writable layer goes with it, while the original image layers underneath remain untouched and ready to spin up a fresh container from scratch at any time.',
    ],
    keyPoints: [
      'An image is a stack of immutable, read-only <strong>layers</strong> plus metadata — not a single monolithic file.',
      'Each <code>FROM</code>, <code>RUN</code>, <code>COPY</code>, and <code>ADD</code> instruction in a Dockerfile produces one new layer.',
      'Layers are content-addressed and shared: two images built on the same base only store that base once on disk.',
      'A running container adds a thin <strong>writable layer</strong> on top of the image\'s read-only layers — this is where <code>docker exec</code> changes actually go.',
      'The writable layer is destroyed when the container is removed; only what is baked into the image\'s layers survives.',
      '<code>docker history &lt;image&gt;</code> lets you see the layer-by-layer build history of any image.',
    ],
    code: `docker history my-app:1.0
# IMAGE          CREATED         CREATED BY                                      SIZE
# 3f9a1b2c4d5e   3 minutes ago   CMD ["node" "server.js"]                        0B
# 8e7d6c5b4a3f   3 minutes ago   COPY ./app /home/app # buildkit                 42.1MB
# 1a2b3c4d5e6f   3 minutes ago   WORKDIR /home/app                               0B
# 9f8e7d6c5b4a   3 minutes ago   RUN mkdir -p /home/app # buildkit               0B
# 7c6b5a4d3e2f   3 minutes ago   ENV MONGO_DB_PWD=password                       0B
# 4d3e2f1a0b9c   3 minutes ago   ENV MONGO_DB_USERNAME=admin                     0B
# <missing>      6 weeks ago     /bin/sh -c #(nop)  CMD ["node"]                 0B
# <missing>      6 weeks ago     /bin/sh -c #(nop) ADD file:5b2b...  in /        44.6MB
# base alpine layers continue below, shared with every other node:13-alpine image...`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: 'The reason pulling a second Node-based image is fast is layer sharing: if it shares the same Alpine base as an image you already have, Docker only downloads the layers it doesn\'t already have on disk.',
      tone: 'accent',
    },
    quiz: {
      question: 'You pull both <code>node:20-alpine</code> and <code>python:3.12-alpine</code>, and they happen to share the exact same <code>alpine:3.19</code> base layer. What happens on disk?',
      options: [
        { label: 'Docker stores the shared Alpine layer once and reuses it for both images', correct: true },
        { label: 'Each image gets its own independent copy of the Alpine layer', correct: false },
        { label: 'The Alpine layer is downloaded twice but only one copy is kept at random', correct: false },
        { label: 'Layers are a build-time-only concept and have no effect on disk usage', correct: false },
      ],
      explanation: 'Layers are content-addressed by hash, so if two images reference the identical layer, Docker recognizes the match and stores it exactly once, reusing it for every image that needs it. This is a real, measurable disk-and-bandwidth saving, not just a caching abstraction confined to build time.',
    },
  },
  {
    id: '4.2',
    title: 'Dockerfile Instructions Reference: FROM, WORKDIR, COPY, RUN, EXPOSE, CMD',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'A Dockerfile is a plain text blueprint for building an image, and its syntax is deliberately simple: a sequence of capitalized instructions, each on its own line, executed from top to bottom, with each one producing (or modifying) the layers described in the previous lesson. <code>FROM &lt;image&gt;</code> must be the first real instruction in almost every Dockerfile — it declares the base image everything else builds on top of. Always prefer a specific, pinned tag like <code>node:20-alpine</code> over an untagged reference or <code>node:latest</code>: <code>latest</code> is just a label that can point at a different image tomorrow, which means the exact same Dockerfile could build something different next week without you changing a single line. You will see why that matters more in the best-practices lesson later in this section.',
      '<code>WORKDIR &lt;path&gt;</code> sets the working directory for every instruction that follows it — <code>RUN</code>, <code>COPY</code>, and the final <code>CMD</code> — and creates that directory inside the image if it does not already exist. This one instruction quietly prevents an entire category of beginner bugs: if you copy your application into <code>/home/app</code> but never set that as the working directory, <code>CMD</code> will try to run from the image\'s default directory (<code>/</code>) and fail to find your files, even though they are sitting right there in the image. Setting <code>WORKDIR /home/app</code> once, near the top of the file, means every subsequent instruction automatically operates relative to that path with no repetition needed.',
      '<code>COPY &lt;src&gt; &lt;dest&gt;</code> copies files from your build context — the directory on your host machine where you run <code>docker build</code> — into the image. It is easy to assume you could just as well write <code>RUN cp &lt;src&gt; &lt;dest&gt;</code>, but the two run in entirely different places: <code>RUN &lt;command&gt;</code> executes a Linux command <em>inside</em> a temporary build container and commits its result as a new layer — this is how you install packages or run any setup step that needs to happen once, at build time — whereas <code>COPY</code> reaches out to your host filesystem to pull files in. You will also encounter <code>ADD</code>, a slightly older instruction with extra behavior — it can automatically extract local <code>.tar</code> archives and fetch remote URLs — but because that "magic" behavior is often surprising, <code>COPY</code> is the idiomatic default unless you specifically need what <code>ADD</code> does. <code>ENV &lt;key&gt;=&lt;value&gt;</code> bakes an environment variable into the image itself; it works, but hardcoding configuration this way means any change requires a full image rebuild, so it is usually better to pass environment-specific values externally with <code>docker run -e</code> or a Compose file\'s <code>environment:</code> section instead, reserving <code>ENV</code> in the Dockerfile for values that genuinely never change across environments.',
      '<code>EXPOSE &lt;port&gt;</code> is the instruction beginners most often misunderstand: it does <strong>not</strong> publish or open a port on your host machine — it is purely documentation, telling anyone reading the Dockerfile (and certain tools) which port the application inside listens on. Actually making that port reachable from outside the container still requires <code>-p &lt;hostPort&gt;:&lt;containerPort&gt;</code> on <code>docker run</code>, exactly as covered in earlier sections. Finally, <code>CMD ["executable", "arg1", "arg2"]</code> — written in this JSON-array "exec form" — defines the default command the container runs when it starts. Only one <code>CMD</code> takes effect (the last one wins if you write several by mistake), and it can be overridden entirely by appending a command after the image name in <code>docker run &lt;image&gt; &lt;command&gt;</code>. The next section covers <code>ENTRYPOINT</code>, which changes how much of that override behavior you get.',
    ],
    keyPoints: [
      '<code>FROM &lt;image&gt;:&lt;tag&gt;</code> is the first instruction; always pin a specific tag rather than relying on <code>latest</code>.',
      '<code>WORKDIR &lt;path&gt;</code> creates and sets the working directory for every instruction after it — the fix for "file not found" errors caused by <code>CMD</code> running from the wrong directory.',
      '<code>COPY &lt;src&gt; &lt;dest&gt;</code> pulls files from the host build context into the image; prefer it over <code>ADD</code> unless you specifically need automatic archive extraction or URL fetching.',
      '<code>RUN &lt;command&gt;</code> executes at build time and commits a new layer; <code>ENV</code> bakes environment variables into the image (prefer passing environment-specific config externally instead).',
      '<code>EXPOSE &lt;port&gt;</code> only documents which port the app listens on — it does not publish anything; you still need <code>-p</code> on <code>docker run</code>.',
      '<code>CMD ["executable", "arg1", "arg2"]</code> (exec form) sets the default startup command; it is entirely replaced if you pass a command after the image name in <code>docker run</code>.',
    ],
    code: `# a minimal but complete, idiomatic reference Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]`,
    codeLabel: 'dockerfile',
    note: {
      label: 'WARNING',
      text: '<code>EXPOSE</code> is documentation, not a port publish. Adding <code>EXPOSE 3000</code> and running the container with plain <code>docker run my-app</code> will still leave the app unreachable at <code>localhost:3000</code> until you add <code>-p 3000:3000</code>.',
      tone: 'accent',
    },
    quiz: {
      question: 'You add <code>EXPOSE 3000</code> to your Dockerfile, rebuild, and start the container with plain <code>docker run my-app</code>. Opening <code>localhost:3000</code> in a browser loads nothing. Why?',
      options: [
        { label: '<code>EXPOSE</code> only documents the port; the container still needs <code>-p 3000:3000</code> (or <code>-P</code>) to publish it to the host', correct: true },
        { label: 'Port 3000 is reserved by Docker and cannot be used', correct: false },
        { label: '<code>EXPOSE</code> requires the app to use HTTPS', correct: false },
        { label: 'The image needs to be rebuilt with the <code>--publish</code> flag', correct: false },
      ],
      explanation: '<code>EXPOSE</code> is metadata for humans and for <code>docker run -P</code> (which auto-publishes every exposed port to a random host port) — by itself it does not bind anything. To reach the app at a known address, you must explicitly map a host port to the container port with <code>-p hostPort:containerPort</code>.',
    },
  },
  {
    id: '4.3',
    title: 'Writing Your First Dockerfile',
    duration: '11 min',
    kind: 'demo',
    summary: [
      'This lesson walks through containerizing a real Node.js application end to end — a small backend with a <code>server.js</code> entry point, a <code>package.json</code>, a pre-installed <code>node_modules</code> folder, a <code>public/index.html</code>, and an <code>images/</code> folder for static assets — sitting alongside a <code>Dockerfile</code> and a <code>docker-compose.yml</code> in the same project directory. The goal is to reproduce, mistake and all, how this typically goes the first time, because the bug you are about to see is one of the most common ones beginners hit, and understanding exactly why it happens is worth more than getting it right by luck.',
      'The first attempt looks reasonable: base the image on <code>node:13-alpine</code> (a specific version, not <code>latest</code>, as covered in the previous lesson), set the two Mongo-related environment variables the app expects, create a directory for the app, copy everything in, and set the startup command. Building and running it with <code>docker build -t my-app:1.0 .</code> and <code>docker run my-app:1.0</code>, though, fails immediately with a module-not-found error. The files were copied into <code>/home/app</code>, but nothing ever told the container that <code>/home/app</code> is where it should look for <code>server.js</code> — so <code>CMD</code> tries to run it from the image\'s default directory, <code>/</code>, where it does not exist.',
      'The fix is the <code>WORKDIR</code> instruction from the previous lesson: adding <code>WORKDIR /home/app</code> right after the directory is created (and before <code>COPY</code>) tells every instruction from that point on — including the final <code>CMD</code> — to operate from <code>/home/app</code>. But an image that already exists cannot be silently overwritten in place: since a stopped container is still referencing the broken image, you have to remove that container first (<code>docker rm</code>), then remove the image (<code>docker rmi</code>), before <code>docker build</code> can produce a corrected one under the same tag. Rebuilding and rerunning after that fix, the app starts cleanly and logs <code>App listening on port 3000</code>.',
      'One more refinement worth making: entering the fixed container with <code>docker exec -it &lt;container&gt; sh</code> (as covered in the previous section — this particular Alpine-based image has no <code>bash</code>) shows that the <em>entire</em> project directory got copied in, including the <code>Dockerfile</code> and <code>docker-compose.yml</code> themselves, which the running application has no use for. Moving just the application files into their own <code>app/</code> subfolder and changing the Dockerfile to <code>COPY ./app /home/app</code> instead of <code>COPY . /home/app</code> keeps the built image lean and free of files that only matter for building it in the first place. A later lesson in this section introduces <code>.dockerignore</code>, which solves this same problem without requiring you to reorganize your project layout at all.',
    ],
    keyPoints: [
      'Any edit to a Dockerfile requires a full rebuild — an existing image cannot be patched in place.',
      'To rebuild under the same tag, remove the container referencing the old image first (<code>docker rm</code>), then the image itself (<code>docker rmi</code>).',
      '"Cannot find module" errors right after containerizing an app are almost always a missing <code>WORKDIR</code>, not a code bug.',
      '<code>WORKDIR</code> both creates the directory and sets it as the working directory for every instruction after it, including <code>CMD</code>.',
      'Only copy into the image what the running application actually needs — not the Dockerfile, Compose file, or other build-only artifacts.',
    ],
    code: `# ---- project layout before the fix ----
# project/
# |-- Dockerfile
# |-- docker-compose.yml
# |-- server.js
# |-- package.json
# |-- node_modules/
# |-- public/index.html
# +-- images/

# ---- attempt #1 (buggy) ----
# FROM node:13-alpine
#
# ENV MONGO_DB_USERNAME=admin
# ENV MONGO_DB_PWD=password
#
# RUN mkdir -p /home/app
#
# COPY . /home/app
#
# CMD ["node", "server.js"]

docker build -t my-app:1.0 .
docker run my-app:1.0
# node:internal/modules/cjs/loader:1078
#   throw err;
#   ^
# Error: Cannot find module '/server.js'
#     at Function._resolveFilename (node:internal/modules/cjs/loader:1075:15)
#     at Function._load (node:internal/modules/cjs/loader:920:27)
# Node.js v13.14.0

# server.js exists, but only at /home/app/server.js - CMD ran from "/" because
# no WORKDIR was ever set. Fix the Dockerfile, then clear out the broken build:
docker ps -a | grep my-app
docker rm 7b2a4e9c1f30
docker rmi my-app:1.0

# ---- attempt #2 (fixed with WORKDIR) ----
# FROM node:13-alpine
#
# ENV MONGO_DB_USERNAME=admin
# ENV MONGO_DB_PWD=password
#
# RUN mkdir -p /home/app
#
# WORKDIR /home/app
#
# COPY . /home/app
#
# CMD ["node", "server.js"]

docker build -t my-app:1.0 .
docker run my-app:1.0
# App listening on port 3000

# ---- project layout after the cleanup refinement ----
# project/
# |-- Dockerfile
# |-- docker-compose.yml
# +-- app/
#     |-- server.js
#     |-- package.json
#     |-- node_modules/
#     |-- public/index.html
#     +-- images/

# ---- attempt #3 (only copy what the app needs) ----
# FROM node:13-alpine
#
# ENV MONGO_DB_USERNAME=admin
# ENV MONGO_DB_PWD=password
#
# RUN mkdir -p /home/app
#
# WORKDIR /home/app
#
# COPY ./app /home/app
#
# CMD ["node", "server.js"]

docker rm -f my-app-container 2>/dev/null
docker rmi my-app:1.0
docker build -t my-app:1.0 .
docker run --name my-app-container my-app:1.0
# App listening on port 3000

docker exec -it my-app-container sh
/home/app # ls
# server.js  package.json  node_modules  public  images
/home/app # exit`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: '"Cannot find module" right after containerizing a Node app is almost never a code problem — check where <code>COPY</code> placed your files versus where <code>CMD</code> actually executes from (the current <code>WORKDIR</code>) before you go looking anywhere else.',
      tone: 'accent',
    },
    quiz: {
      question: 'A Dockerfile copies application files into <code>/home/app</code> with <code>COPY . /home/app</code> but never sets a <code>WORKDIR</code>. Running the built image immediately fails with <code>Error: Cannot find module \'/server.js\'</code>. What is actually happening?',
      options: [
        { label: '<code>CMD</code> runs <code>node server.js</code> from the image\'s default working directory (<code>/</code>), where <code>server.js</code> does not exist — it was copied to <code>/home/app</code> instead', correct: true },
        { label: 'Node.js was installed incorrectly in the base image', correct: false },
        { label: 'The <code>COPY</code> instruction silently failed to copy any files', correct: false },
        { label: '<code>server.js</code> needs to be renamed to <code>index.js</code>', correct: false },
      ],
      explanation: 'Without a <code>WORKDIR</code>, every instruction — including the final <code>CMD</code> — runs from the image\'s default directory, <code>/</code>. The files were copied successfully, just to <code>/home/app</code>, not <code>/</code>, so Node looks in the wrong place. Adding <code>WORKDIR /home/app</code> before <code>COPY</code> and <code>CMD</code> fixes it by pointing both at the same directory.',
    },
  },
  {
    id: '4.4',
    title: 'Building & Tagging Images: docker build & docker tag',
    duration: '8 min',
    kind: 'demo',
    summary: [
      'Turning a Dockerfile into a usable image is the job of <code>docker build</code>. The full form is <code>docker build -t &lt;name&gt;:&lt;tag&gt; &lt;path&gt;</code>. The <code>-t</code> flag names and tags the resulting image — <code>my-app:1.0</code>, for example — and the trailing path (usually just <code>.</code> for "this directory") tells Docker where to find both the Dockerfile and the <strong>build context</strong>: the set of files sent to the Docker daemon that any <code>COPY</code> instruction is allowed to reach into. This is worth understanding explicitly, because it is the reason a stray, huge folder sitting next to your Dockerfile can make even a trivial build noticeably slower — the entire directory gets bundled up and sent to the daemon before the build even starts, whether or not anything in it is actually copied.',
      'Once built, an image can carry more than one tag at a time, and that is exactly what <code>docker tag &lt;source&gt; &lt;target&gt;</code> is for: <code>docker tag my-app:1.0 my-app:latest</code> does not duplicate any image data — it creates a second name pointing at the exact same underlying image ID and layers, instantly and at essentially zero disk cost, because of the same content-addressed layer model from earlier in this section. This is also how you prepare an image for a specific registry: <code>docker tag my-app:1.0 myregistry.example.com/my-app:1.0</code> adds a fully-qualified name that <code>docker push</code> can later send to that registry, without touching the original <code>my-app:1.0</code> tag at all.',
      'You will also run into the cleanup commands from the previous demo again here, because they come up constantly during iterative development: <code>docker rm &lt;container&gt;</code> deletes a stopped container, and <code>docker rmi &lt;image&gt;</code> deletes an image — but only once nothing references it anymore. If you try to delete an image while a container (even a stopped one) still points at it, Docker refuses with an "image is being used by a stopped container" error, which is why the container always has to go first. An image that loses all of its tags without being deleted becomes a "dangling" image, shown as <code>&lt;none&gt;:&lt;none&gt;</code> in <code>docker images</code> — harmless, but worth periodically clearing with <code>docker image prune</code> so it doesn\'t quietly eat disk space.',
      'Finally, it is worth noticing what happens on a second build of the same Dockerfile with no changes: it finishes almost instantly, because Docker recognizes that every instruction produces the same layer it already has cached and skips re-executing them. That caching behavior is exactly what makes instruction <em>order</em> inside a Dockerfile a real performance decision rather than a stylistic one — the subject of the best-practices lesson at the end of this section.',
    ],
    keyPoints: [
      '<code>docker build -t &lt;name&gt;:&lt;tag&gt; &lt;path&gt;</code> — the path is the <strong>build context</strong>: everything <code>COPY</code> is allowed to reach, sent to the daemon in full.',
      '<code>docker tag &lt;source&gt; &lt;target&gt;</code> creates a new name pointing at the same image ID and layers — no data is duplicated, so it is instant.',
      'Tagging with a registry address (<code>docker tag my-app:1.0 myregistry.example.com/my-app:1.0</code>) is how you prepare an image for <code>docker push</code>.',
      'You must remove a container referencing an image (<code>docker rm</code>) before you can remove the image itself (<code>docker rmi</code>).',
      'An untagged image becomes a "dangling" <code>&lt;none&gt;:&lt;none&gt;</code> entry; clean these up periodically with <code>docker image prune</code>.',
      'An unchanged Dockerfile rebuilds almost instantly because every layer is served from the build cache instead of re-executed.',
    ],
    code: `docker build -t my-app:1.0 .
# [+] Building 4.2s
#  => [1/4] FROM docker.io/library/node:13-alpine
#  => [2/4] RUN mkdir -p /home/app
#  => [3/4] COPY ./app /home/app
#  => [4/4] WORKDIR /home/app
#  => exporting to image
#  => => writing image sha256:3f9a1b2c4d5e...
#  => => naming to docker.io/library/my-app:1.0

docker images
# REPOSITORY   TAG    IMAGE ID       CREATED         SIZE
# my-app       1.0    3f9a1b2c4d5e   9 seconds ago   127MB

# add extra tags without copying any image data
docker tag my-app:1.0 my-app:latest
docker tag my-app:1.0 myregistry.example.com/my-app:1.0

docker images
# REPOSITORY                       TAG      IMAGE ID       SIZE
# my-app                           1.0      3f9a1b2c4d5e   127MB
# my-app                           latest   3f9a1b2c4d5e   127MB
# myregistry.example.com/my-app    1.0      3f9a1b2c4d5e   127MB
# (same IMAGE ID for all three - one physical image, three names)

# cleaning up an old build - container first, then image
docker ps -a | grep my-app
docker rm 7b2a4e9c1f30
docker rmi my-app:1.0

# clear out any leftover untagged (dangling) images
docker image prune`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: '<code>docker tag</code> creates a new reference pointing at the exact same image layers — it never copies image data. That is why you can tag one build for <code>latest</code>, a version number, and a registry address simultaneously with no extra disk cost.',
      tone: 'accent',
    },
    quiz: {
      question: 'You run <code>docker tag my-app:1.0 my-app:2.0</code>. What actually happens on disk?',
      options: [
        { label: 'A new tag is created that points at the same underlying image layers — no image data is copied', correct: true },
        { label: 'The entire image is duplicated under the <code>2.0</code> tag', correct: false },
        { label: '<code>my-app:1.0</code> is deleted and replaced by <code>my-app:2.0</code>', correct: false },
        { label: 'The Dockerfile is automatically rebuilt to produce the new version', correct: false },
      ],
      explanation: 'Because images are identified by a content hash of their layers, tagging is just attaching an additional human-readable name to an existing image ID. Both <code>my-app:1.0</code> and <code>my-app:2.0</code> continue to exist and point at identical layers until one of them is explicitly removed.',
    },
  },
  {
    id: '4.5',
    title: 'CMD vs ENTRYPOINT — When to Use Which',
    duration: '7 min',
    kind: 'concept',
    summary: [
      'The previous reference lesson covered <code>CMD</code> as "the default startup command," and mentioned that it can be replaced entirely by appending a command after the image name in <code>docker run &lt;image&gt; &lt;command&gt;</code>. <code>ENTRYPOINT</code> exists for the situations where you do <em>not</em> want that to be so easy. <code>ENTRYPOINT ["executable", "arg1"]</code> sets the fixed program a container always runs — it is not silently swapped out by whatever gets typed after the image name on <code>docker run</code>. Instead, when both <code>ENTRYPOINT</code> and <code>CMD</code> are present, anything supplied at <code>docker run</code> time (or <code>CMD</code>\'s own value, if nothing is supplied) is <em>appended as arguments</em> to the <code>ENTRYPOINT</code>, rather than replacing it outright.',
      'This combination is the idiomatic pattern for images that should behave like a single-purpose command-line tool: <code>ENTRYPOINT</code> fixes <em>what</em> runs, and <code>CMD</code> supplies sensible <em>default arguments</em> that a user can override without needing to know or repeat the underlying executable. For example, with <code>ENTRYPOINT ["node", "server.js"]</code> and <code>CMD ["--port", "3000"]</code> in the same Dockerfile, running the container plainly executes <code>node server.js --port 3000</code>. Running it as <code>docker run my-app --port 8080</code> does not touch the <code>node server.js</code> part at all — it only replaces <code>CMD</code>\'s default arguments, producing <code>node server.js --port 8080</code>.',
      'Deliberately overriding the <code>ENTRYPOINT</code> itself is still possible, but it takes an explicit flag rather than a plain trailing command: <code>docker run --entrypoint sh my-app</code>. That extra friction is the whole point — it protects the container\'s core behavior from being changed by accident, while still leaving an escape hatch for the rare case you genuinely need one (for example, dropping into a shell to debug an image built this way, since a plain <code>docker run my-app sh</code> would just be appended as an argument to <code>node server.js</code> and fail).',
      'The decision between the two comes down to what kind of image you are building. Reach for the <code>ENTRYPOINT</code> + default-<code>CMD</code>-arguments pattern when the image is meant to always run one thing — a database server, a CLI tool, anything you want to behave predictably no matter how it is invoked. Stick with <code>CMD</code> alone, with no <code>ENTRYPOINT</code>, when the image is more like a general-purpose environment where you frequently want to run an entirely different command against the same image — for example, <code>docker run my-app npm test</code> instead of the default <code>npm start</code>, without fighting an <code>ENTRYPOINT</code> to do it.',
    ],
    keyPoints: [
      'A trailing command on <code>docker run &lt;image&gt; &lt;command&gt;</code> <strong>replaces <code>CMD</code> entirely</strong>, but only <strong>appends arguments</strong> to <code>ENTRYPOINT</code>.',
      'The idiomatic pattern is <code>ENTRYPOINT</code> for the fixed executable plus <code>CMD</code> for its overridable default arguments.',
      'Overriding <code>ENTRYPOINT</code> requires the explicit <code>--entrypoint</code> flag — a deliberate extra step, not an accident.',
      'Use <code>ENTRYPOINT</code> when the image should always behave like one dedicated program (a database, a CLI tool).',
      'Use <code>CMD</code> alone when the entire command should be easy to swap out at run time (a general app image you also run test/debug commands against).',
      'Prefer the exec (JSON array) form, <code>["executable", "arg"]</code>, for both instructions over the shell form.',
    ],
    code: `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENTRYPOINT ["node", "server.js"]
CMD ["--port", "3000"]`,
    codeLabel: 'dockerfile',
    note: {
      label: 'DECISION POINT',
      text: 'Choose <code>ENTRYPOINT</code> when the image should always run one fixed program no matter how it is invoked. Choose plain <code>CMD</code>, with no <code>ENTRYPOINT</code>, when you want the entire command to stay trivially swappable at run time.',
      tone: 'accent',
    },
    quiz: {
      question: 'A Dockerfile has <code>ENTRYPOINT ["node", "server.js"]</code> and <code>CMD ["--port", "3000"]</code>. What command actually executes when someone runs <code>docker run my-app --port 8080</code>?',
      options: [
        { label: '<code>node server.js --port 8080</code>', correct: true },
        { label: '<code>node server.js</code> — the override is ignored', correct: false },
        { label: '<code>--port 8080</code> — it replaces the entrypoint entirely', correct: false },
        { label: 'An error, because <code>ENTRYPOINT</code> cannot take arguments', correct: false },
      ],
      explanation: 'With both instructions present, the arguments passed at <code>docker run</code> time replace only <code>CMD</code>\'s default arguments and are appended to the fixed <code>ENTRYPOINT</code>. <code>ENTRYPOINT</code> itself is never silently swapped out this way — that would require the explicit <code>--entrypoint</code> flag.',
    },
  },
  {
    id: '4.6',
    title: 'Dockerfile Best Practices: Layer Caching Order, .dockerignore, and Multi-Stage Builds',
    duration: '9 min',
    kind: 'summary',
    summary: [
      'Everything in this section connects to one idea worth closing on: layer caching, from the theory lesson, is not just an implementation detail — it should actively shape how you order a Dockerfile. Docker caches each layer, and the moment any instruction\'s input changes, that layer and <em>every layer after it</em> gets invalidated and rebuilt, even if those later instructions themselves did not change. Notice that the demo Dockerfile earlier in this section copied the entire application, <code>node_modules</code> included, in a single <code>COPY</code> step and never ran <code>npm install</code> inside the container at all — it relied on dependencies already installed on the host. That is fragile: native dependencies compiled on your host operating system are not guaranteed to work inside the container\'s Linux environment, especially if you are on macOS or Windows.',
      'The idiomatic fix is both more reliable and faster to rebuild: copy only the dependency manifest first, install inside the container, and only then copy the rest of the source. With this ordering, changing a single line in <code>server.js</code> and rebuilding only re-runs the final <code>COPY . .</code> and anything after it — the <code>RUN npm install</code> layer above it is untouched and served straight from cache, because its input (<code>package*.json</code>) never changed. Reverse that order — copy everything, then run <code>npm install</code> — and every source change forces a full dependency reinstall on every single rebuild, turning a few seconds into minutes during active development.',
      'A <code>.dockerignore</code> file, placed next to the Dockerfile, solves the exact problem the earlier demo worked around manually by moving files into an <code>app/</code> subfolder: it excludes files from the build context entirely, so they are never sent to the daemon and never available to <code>COPY</code>, regardless of your project layout. A typical one excludes version control metadata, the Dockerfile itself, and anything that should be installed fresh inside the container rather than copied in from the host: <code>.git</code>, <code>node_modules</code>, <code>Dockerfile</code>, <code>docker-compose.yml</code>, and local environment files.',
      'Finally, <strong>multi-stage builds</strong> address final image size and security surface, both of which matter once you are shipping images rather than just running them locally. A single-stage build has to include everything used at any point during the build — compilers, dev dependencies, source maps — inside the exact same image that ends up running in production, whether or not any of that is actually needed at runtime. A multi-stage Dockerfile instead uses multiple <code>FROM</code> blocks: an earlier, named stage does the heavy lifting (installing full dependencies, compiling, bundling), and the final stage starts fresh from a clean base image and uses <code>COPY --from=&lt;stage&gt;</code> to pull across only the finished build output — discarding the build tools and intermediate files entirely. The result is routinely a final image many times smaller than the equivalent single-stage build, with a much smaller attack surface because there is no compiler or dev-dependency tree sitting inside your production container.',
    ],
    keyPoints: [
      'Order Dockerfile instructions from least-to-most likely to change: copy dependency manifests and install <strong>before</strong> copying application source, so code edits don\'t invalidate the install layer.',
      'Copying a host-built <code>node_modules</code> folder into the image (instead of running the install inside the container) risks native-dependency mismatches across operating systems.',
      '<code>.dockerignore</code> excludes files from the build context entirely — the standard fix for keeping the Dockerfile, Compose file, and <code>.git</code> out of your image, without reorganizing your repo.',
      'Multi-stage builds use multiple <code>FROM</code> blocks: an early "builder" stage compiles/installs everything, and <code>COPY --from=&lt;stage&gt;</code> pulls only the finished output into a clean final stage.',
      'Multi-stage builds shrink final image size dramatically and remove build-only tools (compilers, dev dependencies) from the production image entirely.',
      'Combine related <code>RUN</code> commands with <code>&amp;&amp;</code> to reduce layer count, and consider a non-root <code>USER</code> in the final stage for production images.',
    ],
    code: `# .dockerignore
.git
node_modules
npm-debug.log
Dockerfile
docker-compose.yml
.env
*.md

# ---- Dockerfile: cache-friendly ordering ----
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]

# ---- Dockerfile: multi-stage build ----
# Stage 1: build - has the full toolchain, discarded afterward
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: runtime - only the finished artifact ships
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]`,
    codeLabel: 'dockerfile',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'A few deliberate ordering choices can take a rebuild during active development from minutes down to seconds, and a multi-stage build can shrink a shipped image from well over a gigabyte down to tens of megabytes.',
      tone: 'green',
    },
    quiz: {
      question: 'A Dockerfile has <code>COPY . .</code> immediately followed by <code>RUN npm install</code>. You change one line in <code>server.js</code> and rebuild. What happens to the <code>npm install</code> layer?',
      options: [
        { label: 'It re-runs from scratch, because the <code>COPY . .</code> layer above it changed and cache invalidation cascades to every instruction after it', correct: true },
        { label: 'It is skipped, since <code>package.json</code> itself did not change', correct: false },
        { label: 'Only <code>server.js</code> is re-copied and every other layer stays cached', correct: false },
        { label: 'Docker automatically detects that only <code>package.json</code> matters and reorders the instructions for you', correct: false },
      ],
      explanation: 'Docker caches layers strictly in the order they are written, and any change to a layer\'s input invalidates that layer and everything after it in the file — regardless of whether the later instruction\'s own logical inputs (like <code>package.json</code>) actually changed. Copying the manifest and installing dependencies before copying the rest of the source is what avoids this exact problem.',
    },
  },
]
