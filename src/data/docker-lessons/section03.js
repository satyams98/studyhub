export default [
  {
    id: '3.1',
    title: 'Reading Container Output with docker logs',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'Every process running inside a container writes its output somewhere, and for the overwhelming majority of containerized applications that "somewhere" is <code>stdout</code> (standard output) and <code>stderr</code> (standard error) — the same two streams any normal command-line program writes to. Docker automatically captures whatever the container\'s main process (the one started by the Dockerfile\'s <code>CMD</code> or <code>ENTRYPOINT</code>) prints to those streams and stores it as that container\'s log. You do not have to configure anything for this to work — it happens from the moment the container starts, for every container, always. The command that reads that captured output back is <code>docker logs</code>.',
      'The basic syntax is <code>docker logs &lt;container&gt;</code>, where <code>&lt;container&gt;</code> can be either the container\'s ID or its name. This is a good moment to explain container naming, because you will lean on it constantly. When you start a container with <code>docker run</code> and do not specify a name, Docker auto-generates one for you — something like <code>affectionate_turing</code> — which is memorable but tells you nothing about what the container actually is. Pass the <code>--name</code> flag at creation time to give it a name you will actually recognize, for example <code>docker run -d -p 6379:6379 --name redis-cache redis:7-alpine</code>. From then on, any command that expects a container reference — including <code>docker logs</code>, and <code>docker exec</code> in the next lesson — can use <code>redis-cache</code> directly instead of you having to look up its ID with <code>docker ps</code> first.',
      'A raw <code>docker logs</code> call dumps the entire history captured so far and exits. That is fine for a quick look, but during active debugging you usually want more control. <code>-f</code> (or <code>--follow</code>) keeps the command running and streams new log lines to your terminal as they are written, exactly like the Linux <code>tail -f</code> command — essential when you are about to trigger the bug and want to watch it happen in real time. <code>--tail N</code> shows only the last <code>N</code> lines instead of the full history, which matters once a long-running container has accumulated thousands of lines you do not care about. <code>-t</code> prefixes every line with a timestamp, which is invaluable for lining up an error in one container\'s logs with an event in another container or in your own application code.',
      'One limitation worth knowing up front: <code>docker logs</code> only shows what the container\'s main process wrote to <code>stdout</code>/<code>stderr</code>. If an application is instead configured to write its logs to a file inside the container\'s own filesystem, <code>docker logs</code> will show nothing useful, even though the app is logging plenty. This is why well-behaved containerized applications are built to log to <code>stdout</code>/<code>stderr</code> rather than to local files — it is what makes <code>docker logs</code> (and log-aggregation tools built on top of it) work at all. If you ever run <code>docker logs</code> and get silence from a container you know is active, that mismatch is the first thing to suspect.',
    ],
    keyPoints: [
      '<code>docker logs &lt;container&gt;</code> reads the <code>stdout</code>/<code>stderr</code> that Docker has captured from that container\'s main process.',
      '<code>&lt;container&gt;</code> can be the ID from <code>docker ps</code> or a friendly name you assigned at creation time with <code>--name</code>.',
      '<code>-f</code> / <code>--follow</code> streams new lines live, like <code>tail -f</code>; use it while reproducing a bug.',
      '<code>--tail N</code> limits output to the last <code>N</code> lines instead of the entire history.',
      '<code>-t</code> adds a timestamp to each line, useful for correlating events across containers.',
      'If an app logs to a file instead of <code>stdout</code>/<code>stderr</code>, <code>docker logs</code> will show nothing — that is an application design issue, not a Docker bug.',
    ],
    code: `# start two named containers from the same kind of image so we can tell them apart
docker run -d -p 6379:6379 --name redis-old redis:6-alpine
docker run -d -p 6380:6379 --name redis-latest redis:7-alpine

docker ps
# CONTAINER ID   IMAGE            STATUS          NAMES
# 8f3a1c2b9d40   redis:7-alpine   Up 8 seconds    redis-latest
# 1e7d4f6a2c31   redis:6-alpine   Up 12 seconds   redis-old

# something looks off with the older one - check its logs
docker logs redis-old

# stream logs live, starting from just the last 20 lines
docker logs -f --tail 20 redis-old

# add timestamps to line the logs up with when your app tried to connect
docker logs -t redis-old
# 2026-09-23T10:02:14.001Z 1:M * Ready to accept connections tcp`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: '<code>docker logs</code> is almost always the fastest way to find out why a container crashed or is behaving unexpectedly. Check it before reaching for <code>docker exec</code> — most failures leave a clear error message sitting right there in stdout or stderr.',
      tone: 'accent',
    },
    quiz: {
      question: 'You want to watch a container\'s logs update live as new lines are written, instead of getting a one-time dump of everything printed so far. Which command does that?',
      options: [
        { label: '<code>docker logs --tail 0 &lt;container&gt;</code>', correct: false },
        { label: '<code>docker logs -f &lt;container&gt;</code>', correct: true },
        { label: '<code>docker ps -a &lt;container&gt;</code>', correct: false },
        { label: '<code>docker logs --all &lt;container&gt;</code>', correct: false },
      ],
      explanation: '<code>-f</code> (<code>--follow</code>) keeps the log command running and streams new lines as they arrive, like <code>tail -f</code>. <code>--tail 0</code> would actually suppress history and, without <code>-f</code>, exit immediately having shown nothing. <code>docker ps -a</code> lists containers, it does not show logs. <code>--all</code> is not a real flag for <code>docker logs</code>.',
    },
  },
  {
    id: '3.2',
    title: 'Shelling Into a Running Container with docker exec',
    duration: '7 min',
    kind: 'concept',
    summary: [
      'While <code>docker logs</code> shows you what a container has already printed, <code>docker exec</code> lets you run a new command inside a container that is already running — most commonly, to open an interactive shell and look around. This is an important distinction from <code>docker run</code>, which always creates a brand-new container from an image. <code>docker exec</code> never creates anything; it reaches into an existing, live container\'s process and filesystem namespace and runs a command there. If the container is not running, <code>docker exec</code> has nothing to attach to and will fail immediately.',
      'The syntax for an interactive session is <code>docker exec -it &lt;container&gt; &lt;command&gt;</code>. The two flags are worth understanding separately rather than memorizing as a pair: <code>-i</code> keeps STDIN open so you can actually type input, and <code>-t</code> allocates a pseudo-TTY so the session behaves like a normal terminal — with prompts, line editing, and the works. Used together, <code>-it</code> is what gives you the familiar feeling of "being inside" the container: your cursor changes, and every command you type from that point on executes inside the container, not on your host machine.',
      'Which shell you ask for matters. Many images — especially anything based on Alpine Linux, which you will learn more about in the next section — are deliberately minimal and do not ship the full <code>bash</code> shell, only the much smaller POSIX-compliant <code>sh</code> (usually provided by BusyBox). Try <code>docker exec -it &lt;container&gt; bash</code> first; if you see an error like <code>exec: "bash": executable file not found in $PATH</code>, fall back to <code>docker exec -it &lt;container&gt; sh</code>. One of the two will always work. Once inside, you are logged in as <code>root</code> by default and can run ordinary Linux commands — <code>ls</code>, <code>cd</code>, <code>cat</code>, <code>env</code> — against a real (if minimal) filesystem, because that is exactly what it is: a Linux filesystem, just one confined to that container.',
      'You do not actually need an interactive shell for most checks. <code>docker exec &lt;container&gt; &lt;command&gt;</code> without <code>-it</code> runs a single one-off command and prints its result immediately, which is often faster than opening a shell just to check one thing — for example <code>docker exec redis-old redis-cli ping</code> or <code>docker exec my-api env</code>. Keep in mind, though, that anything you change from inside an exec session — editing a config file, installing a package with <code>apk</code> or <code>apt</code> — only touches the container\'s writable layer (covered in the next section). It disappears the moment that container is removed and was never part of the underlying image. Treat <code>exec</code> as a diagnostic tool, not a way to patch a running system permanently.',
    ],
    keyPoints: [
      '<code>docker exec</code> runs a command inside an <strong>already running</strong> container; <code>docker run</code> always creates a new one.',
      '<code>-i</code> keeps STDIN open, <code>-t</code> allocates a pseudo-TTY; <code>-it</code> together gives you a normal interactive shell.',
      'Try <code>bash</code> first, then fall back to <code>sh</code> — many minimal images (Alpine-based ones especially) don\'t include <code>bash</code>.',
      '<code>docker exec &lt;container&gt; &lt;command&gt;</code> works without <code>-it</code> for quick, non-interactive one-off checks.',
      'You are <code>root</code> inside the shell by default, with full access to inspect files, environment variables, and configuration.',
      'Changes made through <code>exec</code> live only in the container\'s writable layer — they vanish when the container is removed and are <strong>not</strong> saved to the image.',
    ],
    code: `# try the full shell first
docker exec -it redis-latest bash
# OCI runtime exec failed: exec: "bash": executable file not found in $PATH: unknown

# fall back to sh - almost every image has it
docker exec -it redis-latest sh
/data # pwd
/data
/data # ls
dump.rdb
/data # env
REDIS_VERSION=7.2.4
HOSTNAME=8f3a1c2b9d40
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
/data # exit

# or skip the shell entirely for a single check
docker exec redis-latest redis-cli ping
# PONG

docker exec my-api env | grep MONGO
# MONGO_DB_USERNAME=admin
# MONGO_DB_PWD=password`,
    codeLabel: 'terminal',
    note: {
      label: 'WARNING',
      text: 'Fixing a problem by editing files inside a container with <code>docker exec</code> feels productive, but the fix disappears the moment the container restarts or is removed. Treat <code>exec</code> as a read-only diagnostic tool — real, lasting fixes belong in the Dockerfile or your <code>docker-compose.yml</code> so they survive a rebuild.',
      tone: 'accent',
    },
    quiz: {
      question: 'Running <code>docker exec -it web-app bash</code> returns <code>Error response from daemon: Container ... is not running</code>. What is the most likely cause?',
      options: [
        { label: 'The <code>web-app</code> container has already exited, and <code>exec</code> can only target a running container', correct: true },
        { label: '<code>bash</code> is not installed in the image', correct: false },
        { label: 'The command needs to be run with <code>sudo</code>', correct: false },
        { label: 'The <code>web-app</code> image does not exist locally', correct: false },
      ],
      explanation: 'This specific error means Docker found the container but it is not currently running, so there is no live process namespace for <code>exec</code> to attach to — check <code>docker ps -a</code> for its status and <code>docker logs</code> for why it stopped. A missing <code>bash</code> binary produces a different error ("executable file not found in $PATH"), not "is not running".',
    },
  },
  {
    id: '3.3',
    title: 'A Practical Debugging Workflow',
    duration: '9 min',
    kind: 'demo',
    summary: [
      'Reading about <code>docker logs</code> and <code>docker exec</code> in isolation only gets you so far — the real skill is combining them into a workflow when something actually breaks. Here is a realistic scenario: you have a <code>cache</code> container running Redis and a <code>web-api</code> container that depends on it. You start both, and a minute later <code>web-api</code> has stopped responding. This lesson walks through diagnosing and fixing it end to end, using nothing but the commands from the previous two lessons plus <code>docker ps -a</code> and the <code>docker run</code> vs <code>docker start</code> distinction.',
      'Step one is always <code>docker ps -a</code> — the <code>-a</code> matters here because a crashed container is not "running" and would be invisible in a plain <code>docker ps</code>. The <code>STATUS</code> column tells the story immediately: something like <code>Exited (1) 12 seconds ago</code> means the container\'s main process ran and terminated with a non-zero exit code, which by Linux convention signals an error (<code>0</code> means clean success). Step two is <code>docker logs web-api</code>, which shows the actual error the process printed right before it died — in this case, something like a connection-refused error pointing at the cache container\'s address. That single line usually tells you exactly what broke.',
      'The natural next question is: is the dependency actually the problem, or is <code>web-api</code>\'s configuration wrong? You verify independently by running a one-off command against the <code>cache</code> container itself, without needing an interactive shell: <code>docker exec cache redis-cli ping</code>. If that comes back <code>PONG</code>, Redis itself is healthy right now — which means the real bug was a <strong>startup-order race condition</strong>: <code>web-api</code> started and immediately tried to connect before Redis, inside its own container, had finished initializing. <code>docker ps</code> showing a container as "Up" only means its main process is still alive; it says nothing about whether the service inside it has finished booting and is ready to accept connections. That gap between "process started" and "service ready" is exactly where this class of bug lives.',
      'Because the underlying cause was only timing and Redis is confirmed healthy now, there is nothing wrong with <code>web-api</code>\'s image or configuration that needs rebuilding — it just needs to try connecting again. This is precisely the distinction covered earlier between <code>docker run</code> and <code>docker start</code>: <code>docker run</code> would build a brand-new container from the image, discarding the crashed one and its history, and could even collide on the port bindings the old one still holds. <code>docker start web-api</code> is the correct move — it resumes the existing, already-configured container with all of its original name, ports, and environment variables intact, no rebuild and no re-typing of flags required. A follow-up <code>docker logs -f web-api</code> confirms it connects successfully this time. This exact failure mode is common enough in real deployments that production setups do not rely on manually noticing and restarting a container: restart policies (<code>docker run --restart on-failure</code>) tell Docker to retry automatically, and orchestration tools add real readiness checks — Docker Compose\'s <code>depends_on</code> with a <code>healthcheck</code>, or a Kubernetes readiness probe — so a dependent container only starts once its dependency has proven it is actually ready, not just alive. You will meet both of these later in the course; for now, knowing how to read the symptoms by hand is what makes those automated tools make sense once you get there.',
    ],
    keyPoints: [
      '<code>docker ps -a</code> and its <code>STATUS</code>/exit-code column are the first diagnostic signal — always check this before anything else.',
      'Match the error in <code>docker logs</code> against what else was happening at startup, especially other containers it depends on.',
      'Use <code>docker exec &lt;dependency&gt; &lt;check-command&gt;</code> to independently confirm a dependency is truly ready, not just marked "Up".',
      '"Up" in <code>docker ps</code> means the process is alive, not that the service inside has finished initializing — that gap causes startup-order races.',
      '<code>docker start</code> resumes an exited container with its original configuration; <code>docker run</code> would create an entirely new, separate container.',
      'Production systems solve this class of bug with restart policies and health/readiness checks, not manual restarts.',
    ],
    code: `docker ps -a
# CONTAINER ID   IMAGE            STATUS                     NAMES
# 4a1b7c9e0f22   my-api:1.0       Exited (1) 12 seconds ago  web-api
# 9d3e5f8a1b60   redis:7-alpine   Up 2 minutes               cache

docker logs web-api
# Connecting to Redis at cache:6379...
# Error: connect ECONNREFUSED cache:6379
#     at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1595:16)
# process exited with code 1

# is the dependency actually healthy right now?
docker exec cache redis-cli ping
# PONG

# Redis is fine - web-api just started before it was ready.
# No rebuild needed, just resume the existing container:
docker start web-api

docker logs -f web-api
# Connecting to Redis at cache:6379...
# Connected to Redis
# Server listening on port 3000

# for comparison, this would have been the WRONG move:
# docker run -d -p 3000:3000 --name web-api my-api:1.0
# -> fails: port 3000 already bound to the old (exited) container's config,
#    and you now have two containers to clean up instead of one running`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: '"Up" in <code>docker ps</code> only means the container\'s main process is still running — it says nothing about whether the service inside has finished initializing and is actually ready to accept connections. That gap is exactly where startup-order bugs live.',
      tone: 'accent',
    },
    quiz: {
      question: 'A container named <code>api</code> exits immediately with a connection-refused error right after its database dependency was started. You confirm with <code>docker exec db pg_isready</code> that the database is now ready. What is the single fastest way to get <code>api</code> running again without losing its original configuration?',
      options: [
        { label: '<code>docker start api</code>', correct: true },
        { label: '<code>docker run</code> the image again to create a fresh container', correct: false },
        { label: '<code>docker rm api</code> followed by <code>docker run</code> with the same flags from memory', correct: false },
        { label: '<code>docker exec -it api bash</code> to restart the process manually', correct: false },
      ],
      explanation: '<code>docker start</code> resumes the existing, already-configured container exactly as it was defined — same name, ports, and environment variables — with no rebuild or re-typed flags. Running the image again creates a second, separate container (and can collide on port bindings); removing and recreating it risks mistyping the original flags; and <code>exec</code> cannot target a stopped container at all.',
    },
  },
]
