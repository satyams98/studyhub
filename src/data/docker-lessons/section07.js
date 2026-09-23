export default [
  {
    id: '7.1',
    title: 'Why Containers Need Volumes: The Ephemeral Filesystem Problem',
    duration: '5 min',
    kind: 'theory',
    summary: [
      'Every Docker container gets its own writable filesystem layer, created fresh on top of the read-only layers of the image it was built from. Any file the process inside the container creates, edits, or deletes lives only in that writable layer. This is convenient — it is exactly why a container image can be reused to spin up as many independent containers as you like without them interfering with each other — but it has a serious consequence: that writable layer is tied directly to the container\'s own lifecycle, not to your data\'s lifecycle.',
      'To make this concrete, picture a MongoDB container that a developer has been using for a few days, inserting and updating hundreds of documents through an application. As long as that same container keeps running, or is simply stopped and started again with <code>docker stop</code> / <code>docker start</code>, the data is fine, because the writable layer itself is untouched. The moment that container is removed with <code>docker rm</code> and a brand-new container is created from the same image with <code>docker run</code>, the story changes completely: the new container gets a brand-new, empty writable layer. Every document that was ever inserted is gone, and MongoDB starts up as if it had never been used.',
      'This "ephemeral" behavior is not a bug — it is the deliberate design of containers, and it is genuinely useful for stateless application code. A stateless web server or API container can be killed, replaced, or scaled from one replica to five without anyone worrying about what happens to its filesystem, because it never stored anything worth keeping there in the first place. The problem only shows up with stateful workloads: databases, message queues, anything writing logs you actually want to keep, or any process whose whole job is to remember something across restarts. For those, losing the filesystem every time the container is recreated is unacceptable.',
      'Docker\'s answer to this is the <strong>volume</strong>: a mechanism that mounts a directory living outside the container\'s disposable writable layer — on the Docker host\'s own real, persistent filesystem — into a path inside the container. Anything written to that mounted path is written straight through to the host, bypassing the ephemeral layer entirely, so it survives container removal, restarts, and even upgrading to a new image version. The rest of this section builds directly on the <code>docker-compose.yml</code> skills from the previous section: the next lesson looks at the specific flavors of volumes Docker offers, before a live demo attaches one to a real Node.js + MongoDB application.',
    ],
    keyPoints: [
      'Every container gets a fresh writable filesystem layer built from its image; anything written there disappears once that specific container is deleted.',
      '<code>docker stop</code> followed by <code>docker start</code> reuses the same container and its writable layer, so data usually survives — but <code>docker rm</code> followed by a new <code>docker run</code> creates a brand-new, empty writable layer.',
      'Stateless application containers can be freely killed, replaced, or scaled because they never rely on their own filesystem to remember anything important.',
      'Stateful workloads — databases, queues, anything that must remember data across restarts — cannot rely on the container\'s own filesystem at all.',
      'A <strong>volume</strong> mounts a directory on the Docker host into the container, so data written there survives container removal because it never actually lived in the ephemeral layer to begin with.',
    ],
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Losing a stateless web server\'s filesystem on restart is a non-issue. Doing the same to a database container with no volume attached silently destroys every record it ever stored — and the container will start up successfully, giving no warning that anything was lost.',
      tone: 'accent',
    },
    quiz: {
      question: 'You run <code>docker stop mongo</code> followed by <code>docker start mongo</code> on a MongoDB container with no volume attached. What happens to the data inside it?',
      options: [
        { label: 'It is lost, because a container\'s filesystem is always wiped whenever it stops', correct: false },
        { label: 'It is preserved, because stop/start reuses the same container and its existing writable layer — only removing and recreating the container destroys it', correct: true },
        { label: 'It is lost, because MongoDB flushes its data directory on shutdown by design', correct: false },
        { label: 'It is preserved only if a volume happens to already exist for that image', correct: false },
      ],
      explanation: 'Stopping and starting a container does not delete it or its writable layer — the same container instance and its data are still there when it starts back up. Data is only lost when the container itself is removed (docker rm) and a new one is created from the image, since that new container gets a completely fresh writable layer.',
    },
  },
  {
    id: '7.2',
    title: 'Volume Types: Named Volumes, Bind Mounts & tmpfs',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'Docker offers a few different ways to attach persistent storage to a container, all controlled through the <code>-v</code> flag on <code>docker run</code> (or the equivalent <code>volumes:</code> block in a compose file, covered later in this section). The first is what this course calls a <strong>host volume</strong> — Docker\'s own documentation calls the same thing a <strong>bind mount</strong>. You write <code>docker run -v /host/path:/container/path image</code>, explicitly choosing both sides of the mapping yourself: which exact directory on the host, and which path inside the container it lands on. This gives you full control and is genuinely useful for local development, such as mounting your live source code into a container so edits show up immediately, but it is less portable — the host path has to actually exist with the right permissions on every machine you deploy to.',
      'The second type is the <strong>anonymous volume</strong>: you only specify the container-side path, <code>docker run -v /container/path image</code>, and leave the host side entirely up to Docker. Docker automatically creates a directory for it — on Linux, under <code>/var/lib/docker/volumes/</code>, named with a long random hash — and mounts it in. The data really is persisted, but because you never chose (or even see) a memorable name for that folder, referencing or reusing that exact volume later is inconvenient, and it is easy to accumulate orphaned anonymous volumes over time if you are not deliberately cleaning them up.',
      'The third type, <strong>named volumes</strong>, fixes that inconvenience: you give Docker a name to manage the volume under, either ahead of time with <code>docker volume create app-data</code> or implicitly the first time you reference it with <code>docker run -v app-data:/container/path image</code>. Docker still decides where the physical storage actually lives on the host (again under <code>/var/lib/docker/volumes/</code>), but now you always refer to it by that stable, human-readable name — in <code>docker inspect</code>, in <code>docker volume rm</code>, and in compose files. This is the type recommended for production use and the one the upcoming demo relies on, because it gives you the durability of a volume with none of the "which random folder was that again?" problem of an anonymous one.',
      'A fourth mechanism worth knowing even though it is not covered in the source material for this course: the <strong>tmpfs mount</strong>. Instead of writing to any disk at all, a tmpfs mount stores its contents purely in the host machine\'s memory — created with <code>docker run --tmpfs /container/path image</code> — which means the data disappears the instant the container stops, making it even more short-lived than the container\'s own default writable layer. It only works on Linux hosts, and its use case is narrow but important: holding transient, sensitive data (decrypted secrets, short-lived session tokens) that you explicitly do not want written anywhere persistent, even by accident. Going forward, this guide uses Docker\'s own official terminology — <em>bind mount</em>, <em>volume</em> (anonymous or named), and <em>tmpfs mount</em> — since that is what you will encounter in Docker\'s documentation and CLI output.',
    ],
    keyPoints: [
      '<strong>Bind mount</strong> (this course\'s "host volume"): <code>-v /host/path:/container/path</code> — you choose the exact host directory yourself; flexible, but less portable across machines.',
      '<strong>Anonymous volume</strong>: <code>-v /container/path</code> — Docker auto-creates the storage under a random ID; persisted, but hard to reference again later.',
      '<strong>Named volume</strong>: <code>-v volume-name:/container/path</code> — Docker manages the storage while you keep a stable, friendly name; the recommended default for stateful containers.',
      '<strong><code>tmpfs</code> mount</strong>: memory-only storage that vanishes the instant the container stops — for sensitive, must-never-touch-disk data, Linux hosts only.',
      'Bind mounts and named volumes can both be declared and reused inside a <code>docker-compose.yml</code>, which the rest of this section builds toward.',
    ],
    note: {
      label: 'DECISION POINT',
      text: 'Default to named volumes for anything that needs to persist. Reach for a bind mount only when you need to point at a specific, known host path — most commonly your own source code during local development. Reach for tmpfs only when data must never be written to disk at all.',
      tone: 'accent',
    },
    quiz: {
      question: 'You need a MySQL container\'s data to survive <code>docker rm</code> and to be easy to reference later by a stable name in a Compose file, without remembering an auto-generated folder ID. Which type fits best?',
      options: [
        { label: 'Anonymous volume', correct: false },
        { label: 'Bind mount', correct: false },
        { label: 'Named volume', correct: true },
        { label: 'tmpfs mount', correct: false },
      ],
      explanation: 'A named volume persists data exactly like an anonymous volume, but you address it by a name you chose rather than a random hash, which is exactly what makes it easy to reference consistently across docker run invocations and Compose files. A bind mount would work too, but it forces you to pick and manage a specific host path yourself; tmpfs would lose the data entirely on stop.',
    },
  },
  {
    id: '7.3',
    title: 'Creating & Mounting Volumes',
    duration: '9 min',
    kind: 'demo',
    summary: [
      'This demo works with a small Node.js application backed by MongoDB, with <code>mongo-express</code> running alongside it as a web UI for browsing the database — all three started together with a single <code>docker compose up -d</code>. Without a volume attached to the MongoDB service, everything works fine while the containers are running, but restarting or recreating the MongoDB container wipes out every document the application has ever written, exactly as described in the previous lesson. The fix is to declare a <strong>named volume</strong> in the compose file and mount it into MongoDB\'s container at the one specific path where MongoDB actually stores its data.',
      'That path matters enormously: mounting a volume to the wrong directory inside the container does not cause an error, it just silently persists nothing, because the volume sits at a location the application never writes to. For MongoDB, that path is <code>/data/db</code>. Other databases each have their own default data directory — MySQL uses <code>/var/lib/mysql</code>, Postgres uses <code>/var/lib/postgresql/data</code> — so always confirm the correct path for whatever image you are actually running before assuming a volume mount is doing anything. The compose file below defines the named volume <code>mongo-data</code> once under the top-level <code>volumes:</code> key (with <code>driver: local</code>, telling Docker to manage the physical storage on the local host filesystem), and references it a second time under the <code>mongodb</code> service\'s own <code>volumes:</code> list, mapped to <code>/data/db</code>.',
      'With the volume in place, the workflow to verify persistence is: bring everything up with <code>docker compose up -d</code>, use <code>mongo-express</code> at <code>http://localhost:8080</code> to create a database and a collection and add or edit a document (or let the Node.js application do it), then tear the whole stack down and back up again with <code>docker compose down</code> followed by <code>docker compose up -d</code>. Because <code>down</code> alone removes the containers but leaves named volumes untouched, MongoDB\'s container is completely recreated from scratch, yet the database, the collection, and every document are still there — because they were never actually stored inside the container\'s disposable filesystem in the first place.',
      'To see the volume for real, <code>docker exec -it &lt;mongo-container&gt; bash</code> followed by <code>ls /data/db</code> shows MongoDB\'s live files from inside the container, and <code>docker volume ls</code> on the host shows the volume itself — Compose automatically prefixes the name you declared with the project (folder) name, so <code>mongo-data</code> typically shows up as something like <code>myapp_mongo-data</code>. On disk, the physical location differs by operating system: Linux keeps it directly at <code>/var/lib/docker/volumes/&lt;name&gt;/_data</code>, and Windows keeps the equivalent at <code>C:\\ProgramData\\docker\\volumes\\&lt;name&gt;\\_data</code>. On macOS, that exact path will not be found on the Mac\'s own disk at all, because Docker Desktop actually runs a lightweight Linux virtual machine in the background and stores all container and volume data inside that VM\'s own storage — you have to open a shell into the VM itself to browse it, rather than looking at the Mac\'s host filesystem directly.',
    ],
    keyPoints: [
      'A named volume is declared twice in a compose file: once as a short reference under a service\'s own <code>volumes:</code> list (<code>mongo-data:/data/db</code>), and once with its full definition, including <code>driver: local</code>, under the top-level <code>volumes:</code> key.',
      'Mount the volume at the exact path the database actually writes to, not just any convenient-looking path — <code>/data/db</code> for MongoDB, <code>/var/lib/mysql</code> for MySQL, <code>/var/lib/postgresql/data</code> for Postgres.',
      '<code>docker compose down</code> removes containers and networks but leaves named volumes alone — which is exactly why the data survives being torn down and brought back up.',
      '<code>docker volume ls</code> and <code>docker exec -it &lt;container&gt; ls /data/db</code> let you directly confirm a volume exists and inspect the files it currently holds.',
      'Compose automatically prefixes declared volume names with the project (folder) name on disk, so a volume declared as <code>mongo-data</code> is stored as something like <code>myapp_mongo-data</code>.',
      'On macOS, Docker Desktop stores all volume data inside an internal Linux VM, not directly on the Mac\'s own filesystem — the host paths shown for Linux and Windows will not exist there.',
    ],
    code: `version: '3.8'

services:
  mongodb:
    image: mongo
    ports:
      - 27017:27017
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
    volumes:
      - mongo-data:/data/db

  mongo-express:
    image: mongo-express
    restart: always
    ports:
      - 8080:8081
    environment:
      - ME_CONFIG_MONGODB_ADMINUSERNAME=admin
      - ME_CONFIG_MONGODB_ADMINPASSWORD=password
      - ME_CONFIG_MONGODB_SERVER=mongodb

  my-app:
    build: ./app
    ports:
      - 3000:3000
    depends_on:
      - mongodb

volumes:
  mongo-data:
    driver: local`,
    codeLabel: 'docker-compose.yml',
    note: {
      label: 'WARNING',
      text: 'Mounting a volume to the wrong container path is the most common beginner mistake with volumes: the container starts up without any error, but nothing is actually persisted because the database never writes to that directory. Always confirm the real data directory for whatever image you are running before trusting that a volume is doing its job.',
      tone: 'accent',
    },
    quiz: {
      question: 'You mount a named volume into a MongoDB container at <code>/var/lib/mongo</code> instead of <code>/data/db</code>, then restart the container. What happens to the data?',
      options: [
        { label: 'It is preserved, because a volume is attached to the container', correct: false },
        { label: 'It is lost, because MongoDB always writes its files to /data/db regardless of where you mounted the volume, so the mounted directory is simply never used', correct: true },
        { label: 'The container fails to start because the mount path is invalid', correct: false },
        { label: 'MongoDB automatically redirects its writes to whatever directory the volume is mounted at', correct: false },
      ],
      explanation: 'A volume only persists data written to the exact path it is mounted at. MongoDB has its own hardcoded default data directory, /data/db, and has no idea a volume exists elsewhere — it keeps writing to /data/db inside the ephemeral layer, so that data is lost on the next recreation exactly as if no volume existed at all.',
    },
  },
  {
    id: '7.4',
    title: 'Using Volumes with Docker Compose',
    duration: '7 min',
    kind: 'concept',
    summary: [
      'The previous section introduced <code>docker-compose.yml</code> as the tool for defining and launching a whole multi-container application with a single <code>docker compose up</code>, instead of chaining together several individual <code>docker run</code> commands by hand. Volumes plug directly into that same file, using the same two-part declaration seen in the previous demo: a full definition under the top-level <code>volumes:</code> key, and a short reference under whichever service\'s own <code>volumes:</code> list needs it.',
      'One capability that only really shows its value in Compose is sharing a single named volume across more than one service at once, mounted at a different container path in each if needed. For example, an <code>app</code> service could write uploaded files to <code>/app/uploads</code>, while a separate <code>thumbnail-worker</code> service reads those same files from <code>/worker/incoming</code> — both mapped to the same underlying <code>uploads-data</code> volume. Because both paths point at the exact same data on the host, the worker sees a new file the moment the app writes it, with no network call, shared database, or manual copying involved.',
      'Compose files can also freely mix bind mounts and named volumes side by side. During local development, it is common to bind-mount your live source code into the application container — <code>./src:/app/src</code> — so that code changes on your machine are picked up immediately without rebuilding the image, while still using a named volume for anything that genuinely needs to persist, like a database\'s data directory. A production compose file typically drops the source-code bind mount entirely, since a production host will not have your local project folder sitting on it, and keeps only the named volumes for actual persistent data.',
      'Two Compose-specific commands are worth remembering from this lesson\'s combination of features. <code>docker compose down</code> on its own only stops and removes containers and networks — named volumes declared in the file are left completely intact, which is why the previous lesson\'s data survived being torn down and rebuilt. Adding the <code>-v</code> flag, <code>docker compose down -v</code>, additionally deletes those named volumes — a genuinely common way for someone trying to "clean up" after testing to accidentally destroy a database\'s actual data. Compose is otherwise declarative about volumes: running <code>docker compose up -d</code> again on the same project reuses an already-existing named volume rather than recreating it, so redeploying the same application does not wipe its data.',
    ],
    keyPoints: [
      'The same named volume can be mounted into multiple services at once, letting containers share a single set of files without a network call between them.',
      'Combine a bind mount for live-reloading source code during development with a named volume for genuinely persistent data, like a database, in the same compose file.',
      '<code>docker compose down</code> stops and removes containers and networks but keeps named volumes; <code>docker compose down -v</code> additionally deletes them — a common way to accidentally lose data while "cleaning up".',
      'Re-running <code>docker compose up -d</code> on the same project reuses an existing named volume instead of recreating it, so redeploys do not erase your data.',
      'Production compose files typically drop development-only bind mounts (like a local source-code folder) and keep only the named volumes needed for real persistence.',
    ],
    code: `version: '3.8'

services:
  app:
    build: .
    ports:
      - 3000:3000
    volumes:
      - ./src:/app/src          # bind mount: live source code for local development
      - uploads-data:/app/uploads

  thumbnail-worker:
    build: ./worker
    volumes:
      - uploads-data:/worker/incoming

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=secret
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  uploads-data:
    driver: local
  db-data:
    driver: local`,
    codeLabel: 'docker-compose.yml',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Sharing one named volume between two services is how containers exchange files without any network call at all — the moment app writes to /app/uploads, thumbnail-worker sees the exact same file at /worker/incoming, because both paths point at the same data on the host.',
      tone: 'green',
    },
    quiz: {
      question: 'A teammate runs <code>docker compose down -v</code> to "clean up" after testing, expecting only the stopped containers to be removed. What actually happens to the Postgres data in the <code>db-data</code> named volume declared in the same compose file?',
      options: [
        { label: 'Nothing changes — Compose never touches volumes on a down command', correct: false },
        { label: 'The volume is deleted along with the containers, permanently erasing the database data', correct: true },
        { label: 'The volume is only deleted if no other project is currently using it', correct: false },
        { label: 'Compose automatically backs up the volume before deleting it', correct: false },
      ],
      explanation: 'The -v flag on docker compose down explicitly tells Compose to also remove any named volumes declared in the file, not just the containers and networks. This is one of the most common ways people accidentally destroy real data while thinking they are just tidying up stopped containers.',
    },
  },
]
