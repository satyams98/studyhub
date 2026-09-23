export default [
  {
    id: '8.1',
    title: 'Why Kubernetes? From a Single Docker Host to a Cluster',
    duration: '6 min',
    kind: 'theory',
    summary: [
      'Everything covered so far — <code>docker run</code>, <code>docker compose up</code>, volumes — runs against a single Docker host: one physical or virtual machine with one Docker daemon on it. That is genuinely enough for local development and for small deployments, but production applications usually need to run across many machines, for two separate reasons. The first is capacity: any one server has a fixed amount of CPU, RAM, and disk, so there is a hard ceiling on how many containers it can run and how much traffic it can serve. The second, more important reason is resilience: if that one Docker host crashes, reboots unexpectedly, or loses network connectivity, every single container running on it goes down at the same moment, taking your entire application with it.',
      'Manually solving this by hand with nothing but Docker and Compose quickly becomes impractical. Docker Compose only ever talks to one Docker daemon on one host — it has no built-in concept of "another machine" to spread containers across or fail over to. Spreading an application across multiple servers by hand means personally deciding which server runs which container, manually connecting into each machine to run Docker commands, personally noticing when a container or an entire server has died, manually restarting or moving things when that happens, and manually updating load-balancing configuration every time a container moves. None of that is automated by Docker itself.',
      'This is exactly the gap <strong>Kubernetes</strong> fills. Kubernetes is a <em>container orchestration platform</em>: instead of one Docker host, you get a <em>cluster</em> made up of many machines, called <strong>nodes</strong>, that Kubernetes treats as one large, unified pool of compute capacity. Rather than issuing commands for a specific container on a specific machine, you describe the <em>desired state</em> — "run 3 replicas of this container, with this much CPU and memory, exposed on this port" — and Kubernetes continuously compares that desired state against what is actually running in the cluster, automatically deciding which node runs each container, restarting anything that crashes, rescheduling containers off of a node that dies onto a healthy one, and letting you scale the number of running replicas up or down with a single instruction instead of manually starting or stopping individual containers one at a time.',
      'None of the Docker knowledge from earlier sections becomes obsolete here. Every node in a Kubernetes cluster still runs your existing container images through an actual container runtime under the hood — frequently Docker itself, or a Docker-compatible alternative. What Kubernetes adds on top is an orchestration and scheduling layer, along with a handful of new building blocks — Pods, Services, Deployments, and more — that the rest of this section introduces one at a time, starting with the two kinds of nodes that make up a cluster in the next lesson.',
    ],
    keyPoints: [
      'A single Docker host has finite capacity and is a single point of failure — if it goes down, every container running on it goes down with it.',
      'Manually spreading containers across multiple machines and reacting to crashes by hand does not scale operationally; <code>docker compose</code> only ever manages one host at a time.',
      'Kubernetes is a <strong>container orchestrator</strong>: you declare the desired state (replica count, resources, ports) and it continuously works to keep the cluster\'s real state matching it.',
      'A Kubernetes <strong>cluster</strong> is made of many machines called <strong>nodes</strong>, treated as one unified pool of compute capacity rather than managed one at a time.',
      'Orchestration unlocks automatic scheduling across many machines, self-healing after crashes, on-demand horizontal scaling, and (with the right setup) zero-downtime deployments.',
      'Kubernetes still runs your existing container images via a container runtime on every node — it does not replace what Docker does, it manages many containers across many machines on your behalf.',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'Kubernetes does not replace what you learned about Docker — it automates the operational work of running many containers, reliably, across many machines, that you would otherwise be doing by hand with docker and docker compose alone.',
      tone: 'accent',
    },
    quiz: {
      question: 'A single Docker host running your application via <code>docker compose up</code> crashes in the middle of the night. What is the key difference if the same application were running on a healthy Kubernetes cluster instead?',
      options: [
        { label: 'There is no real difference — Docker itself handles restarts identically in both cases', correct: false },
        { label: 'On the single host, everything stays down until a human intervenes; on a cluster, the control plane detects the missing pods and automatically reschedules them onto a surviving node', correct: true },
        { label: 'Kubernetes would have prevented the underlying host from crashing in the first place', correct: false },
        { label: 'docker compose automatically fails over to another machine, so there is no meaningful difference', correct: false },
      ],
      explanation: 'docker compose has no concept of a second machine to fail over to — it only ever manages one Docker daemon. A Kubernetes cluster spreads pods across multiple nodes, and its control plane continuously watches cluster state and automatically reschedules pods from a dead node onto a healthy one — that automatic detection and recovery is the entire point of orchestration.',
    },
  },
  {
    id: '8.2',
    title: 'Kubernetes Architecture: Master (Control Plane) & Worker Nodes',
    duration: '9 min',
    kind: 'concept',
    summary: [
      'A Kubernetes cluster is built from <strong>nodes</strong> — physical or virtual servers — each playing one of two roles. <strong>Worker nodes</strong> (often just called nodes) are the machines that actually run your application\'s containers. <strong>Master nodes</strong>, collectively known as the <strong>control plane</strong>, manage and make decisions about the entire cluster, but do not run your application\'s own containers themselves. Every real cluster needs at least one of each role to function.',
      'Three processes must run on every worker node. The <strong>container runtime</strong> (Docker, or a Docker-compatible alternative such as containerd) is what actually pulls images and runs containers on that machine. <strong><code>kubelet</code></strong> is the Kubernetes agent installed on the node itself — it is the only process that actually starts and stops pods and containers there, and it continuously reports that node\'s health and available resources back to the control plane. <strong><code>kube-proxy</code></strong> handles network forwarding on the node, making sure traffic sent to a Service reaches the correct pod; it is smart enough to prefer a pod running on the same node as the request\'s origin when one is available, avoiding an unnecessary network hop to another machine.',
      'Four processes run on every master node to form the control plane. The <strong>API server</strong> is the cluster\'s single front door — every request to create, update, query, or delete anything in the cluster, whether from <code>kubectl</code>, a dashboard, or any other client, goes through it, which authenticates and validates the request before anything happens; this also makes it the cluster\'s natural security chokepoint. The <strong>scheduler</strong> decides <em>which</em> worker node a new pod should run on, by comparing the resources that pod requests (CPU, memory) against what each node currently has available and picking the best fit — note that the scheduler only decides; it is the target node\'s own <code>kubelet</code> that actually starts the pod. The <strong>controller manager</strong> continuously watches whether the cluster\'s actual state matches the desired state, and the moment it detects drift — most commonly, a pod that died — it asks the scheduler to place a replacement, which is the mechanism behind Kubernetes\'s self-healing behavior. Finally, <strong><code>etcd</code></strong> is a distributed key-value store holding the entire current state of the cluster: which pods exist, which node each one is on, what resources are available where, and so on. Think of it as the cluster\'s brain — every other control-plane process reads from it and writes to it. Importantly, <code>etcd</code> does <em>not</em> store your application\'s own data, such as rows inside a database running in the cluster — only cluster metadata.',
      'Because control-plane processes, and <code>etcd</code> in particular, are critical to the cluster functioning at all, real-world clusters run <em>multiple</em> master nodes for high availability rather than a single one, with the API server load-balanced across them and <code>etcd</code> forming a distributed store replicated across all of them. Growing a cluster in either direction is straightforward: adding a worker node means installing the container runtime, <code>kubelet</code>, and <code>kube-proxy</code> on a new machine and joining it to the cluster; adding a master node means installing the four control-plane processes on a new machine instead. Master nodes typically need less CPU and RAM than worker nodes, since they coordinate the cluster rather than run the application containers that do the actual heavy lifting.',
    ],
    keyPoints: [
      'Worker nodes run three processes: the <strong>container runtime</strong> (runs containers), <strong><code>kubelet</code></strong> (starts/stops pods on that node and reports its state), and <strong><code>kube-proxy</code></strong> (routes traffic to the right pod, preferring the local node when possible).',
      'Master nodes (the control plane) run four processes: the <strong>API server</strong> (single entry point for every request), the <strong>scheduler</strong> (decides which node a new pod goes on), the <strong>controller manager</strong> (detects state drift like a dead pod and triggers a reschedule), and <strong><code>etcd</code></strong> (the cluster\'s key-value "brain" holding all cluster state).',
      'The scheduler only <em>decides</em> where a pod runs; the target node\'s <code>kubelet</code> is what actually starts it there.',
      '<code>etcd</code> stores cluster metadata only — never your application\'s own data, like database rows.',
      'Production clusters run multiple master nodes for high availability, with the API server load-balanced and <code>etcd</code> replicated across all of them.',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'Every control-plane process exists to answer one question: does the cluster\'s real state match what was requested, and if not, what needs to change? etcd stores the answer to "what is true right now," and the scheduler and controller manager are what act on any mismatch.',
      tone: 'accent',
    },
    quiz: {
      question: 'A worker node\'s <code>kubelet</code> process crashes, but the underlying machine keeps running normally. What is the most direct consequence?',
      options: [
        { label: 'The control plane can no longer schedule new pods onto that node or get status updates from it, since kubelet is the only process that starts/stops pods and reports node health', correct: true },
        { label: 'etcd immediately loses all of the cluster\'s stored state', correct: false },
        { label: 'The API server stops accepting requests for the entire cluster', correct: false },
        { label: 'kube-proxy automatically takes over kubelet\'s responsibilities', correct: false },
      ],
      explanation: 'kubelet is the sole liaison between the control plane and a given worker node — nothing else on that node starts or stops pods or reports its resource state upward. Losing it effectively takes that one node out of scheduling rotation, but has no direct effect on etcd, the API server, or any other node in the cluster.',
    },
  },
  {
    id: '8.3',
    title: 'Core Component: Pods',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'The <strong>Pod</strong> is the smallest deployable unit in Kubernetes. It is important to be precise about what that means: a Pod is not a container, it is an abstraction layer wrapped around one or more containers. Kubernetes deliberately inserts this layer so that it can stay agnostic to whichever specific container runtime is actually doing the work underneath (Docker, containerd, or anything else) — as a cluster user, you only ever create, inspect, and manage Pods through the Kubernetes layer, and never issue container-runtime-specific commands directly against the machines running them.',
      'A Pod usually wraps exactly one application container, and that should be your default assumption and your default design choice. Running multiple containers inside a single Pod is supported, but it is reserved for a narrower pattern: one main application container plus a tightly coupled helper or "sidecar" container — for example, something that ships logs out of the main container — that genuinely needs to share that Pod\'s resources. Containers inside the same Pod share the same network namespace and can reach each other over <code>localhost</code>, and they are always scheduled onto the same node together and live and die together as a unit.',
      'On the networking side, every <strong>Pod</strong> — not every individual container — is assigned its own internal IP address by Kubernetes\'s built-in virtual network. That lets two Pods communicate directly using that address; for example, an application Pod can reach a database Pod over its internal IP, completely independent of which physical or virtual worker node either one actually happens to be running on at the time.',
      'The property that matters most, and is easy to miss at first, is that Pods are <strong>ephemeral</strong>. If a Pod\'s container crashes, the application inside it fails, or the node it was scheduled on runs out of resources or goes down entirely, that specific Pod is gone permanently, and Kubernetes creates a brand-new Pod to take its place — with a brand-new internal IP address. That means hardcoding a Pod\'s IP address anywhere — in another application\'s configuration, in your own code, anywhere at all — will break the moment that Pod is replaced, which happens routinely, not just during rare failures. This exact problem, needing a stable way to reach a group of Pods whose individual addresses keep changing underneath you, is precisely what the next lesson\'s component, the Service, exists to solve. It is also worth knowing upfront that, in practice, you will rarely create a bare Pod directly the way it is described here in isolation — a later lesson on Deployments introduces the object you actually use day to day to manage a set of replicated Pods.',
    ],
    keyPoints: [
      'A Pod is the smallest deployable unit in Kubernetes — an abstraction layer around one or more containers, not a container itself.',
      'Default to <strong>one application container per Pod</strong>; only add a second, helper/sidecar container when it must share that Pod\'s network and lifecycle.',
      'Every <strong>Pod</strong> (not each individual container) gets its own internal IP address from Kubernetes\'s built-in virtual network.',
      'Pods are <strong>ephemeral</strong>: when one dies, Kubernetes replaces it with a brand-new Pod that gets a brand-new IP address — never rely on a Pod\'s address staying the same.',
      'In practice you rarely create Pods directly; a Deployment (covered in a later lesson) manages a set of replicated Pods for you.',
    ],
    code: `apiVersion: v1
kind: Pod
metadata:
  name: my-app-pod
  labels:
    app: my-app
spec:
  containers:
    - name: my-app
      image: my-app:1.0
      ports:
        - containerPort: 3000`,
    codeLabel: 'yaml',
    note: {
      label: 'WARNING',
      text: 'Never hardcode a Pod\'s IP address anywhere. Pods are disposable by design, and any replacement Pod gets a new address — the moment the original one is recreated after a crash, that hardcoded address stops working.',
      tone: 'accent',
    },
    quiz: {
      question: 'An application Pod crashes, and Kubernetes replaces it with a new Pod running the same container image. Which of the following is true about the replacement Pod?',
      options: [
        { label: 'It keeps the exact same internal IP address as the Pod it replaced', correct: false },
        { label: 'It is assigned a brand-new internal IP address, different from the one before', correct: true },
        { label: 'It is guaranteed to be scheduled onto the same worker node as before', correct: false },
        { label: 'It reuses the previous Pod\'s local writable filesystem contents', correct: false },
      ],
      explanation: 'A replacement Pod is an entirely new Pod object with a fresh identity, including a newly assigned IP address, and there is no guarantee it lands on the same node. This is exactly why a stable addressing mechanism on top of Pods — the Service, covered next — is necessary.',
    },
  },
  {
    id: '8.4',
    title: 'Core Component: Services',
    duration: '5 min',
    kind: 'concept',
    summary: [
      'The previous lesson ended on a real problem: Pods die and get replaced with brand-new IP addresses, so anything communicating with them directly by IP breaks the moment that happens. Kubernetes solves this with the <strong>Service</strong>: a component that gives a stable, permanent internal address (and DNS name) to a group of Pods, completely decoupled from those Pods\' own individual lifecycles. When a Pod behind a Service dies and is replaced, the Service\'s own address never changes — only the set of Pods it forwards traffic to is updated automatically behind the scenes. An application Pod can therefore keep talking to "the database service" indefinitely, without ever needing to know or care how many times the actual database Pod has been recreated underneath it.',
      'At this introductory stage, it is enough to know there are two basic reachability flavors of Service. An <strong>internal service</strong> is reachable only from inside the cluster — the right choice for something like a database Pod that should never be exposed to the public internet directly. An <strong>external service</strong> is reachable from outside the cluster, which is necessary for anything end users need to reach through a browser, such as the main application\'s own entry point.',
      'For that external-facing case, a more production-ready pattern than exposing a raw node address and port is placing an <strong>Ingress</strong> component in front of the Service. Ingress lets you route incoming traffic using a real hostname and HTTPS, rather than users hitting a node\'s IP address directly on some arbitrary port number. A request from a browser is directed to Ingress first, and Ingress is responsible for forwarding it on to the correct internal Service.',
      'This lesson is intentionally only an introductory look at what a Service does and why it exists. A full later section on Networking is dedicated to the deep mechanics of Services — walking through the different Service types (ClusterIP, NodePort, LoadBalancer, and headless services), exactly how each one is configured, and when to reach for which. There is no need to memorize that full menu of options yet; the goal here is simply to understand the one core job every Service does, which is giving a stable address to a set of Pods that are, by design, never stable themselves.',
    ],
    keyPoints: [
      'A Service gives a set of Pods a <strong>stable, permanent internal address</strong> that survives individual Pods being replaced.',
      'Other Pods talk to "the service", never directly to an individual Pod\'s own IP — this is what makes constant Pod replacement safe and invisible to callers.',
      'An <strong>internal service</strong> is reachable only from inside the cluster (e.g. a database); an <strong>external service</strong> is reachable from outside it (e.g. a public web app).',
      '<strong>Ingress</strong> sits in front of a Service for external traffic, enabling a real hostname and HTTPS instead of a raw node address and port number.',
      'This is an introductory overview only — Services get a full deep dive, including every specific Service type, later in this course\'s Networking section.',
    ],
    code: `apiVersion: v1
kind: Service
metadata:
  name: my-app-service
spec:
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP`,
    codeLabel: 'yaml',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'A Service is what makes Kubernetes\'s constant Pod replacement invisible to the rest of your application: as long as everything talks to the service\'s stable address instead of a Pod\'s own IP, Pods can die and be recreated all day long without breaking anything that depends on them.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does an application Pod send its database requests to a Service name (e.g. mongodb-service) instead of the database Pod\'s own IP address?',
      options: [
        { label: 'Because Pod IP addresses cannot be used for network communication at all', correct: false },
        { label: 'Because the Service\'s address stays stable even after the database Pod dies and is replaced with a new Pod that has a different IP', correct: true },
        { label: 'Because Services transmit data faster than direct Pod-to-Pod communication', correct: false },
        { label: 'Because Kubernetes forbids Pods from ever addressing each other directly', correct: false },
      ],
      explanation: 'The entire reason Services exist is address stability across Pod replacement, not raw speed or a hard restriction on direct Pod-to-Pod communication. Without the Service in between, the application would need to be updated every time the database Pod was recreated with a new IP.',
    },
  },
  {
    id: '8.5',
    title: 'Core Components: ConfigMaps & Secrets (Overview)',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'Consider a concrete, common scenario: an application Pod needs to know the database Service\'s endpoint name in order to connect to it — say, <code>mongodb-service</code>. The naive way to provide that is to hardcode it directly into the application\'s source code or bake it into the built container image. The problem is what happens when that endpoint ever needs to change: you would be forced to edit code, rebuild the image, push it to a registry, pull the new image into the cluster, and restart the affected Pods — a slow, heavyweight cycle for what might be a single-line configuration change.',
      'Kubernetes solves this with the <strong>ConfigMap</strong>: an object that holds configuration data — URLs, endpoint names, feature flags, any plain-text setting — completely separate from your application\'s image. A ConfigMap is attached to a Pod, most commonly by exposing its entries as environment variables inside the container or by mounting them as a file, and the Pod simply reads whatever the ConfigMap currently contains. Update the ConfigMap, and the application picks up the new configuration on its next restart without ever touching the image or rebuilding anything.',
      'For sensitive values, a plain-text ConfigMap is the wrong tool entirely: a database username and password, an API key, or a TLS certificate should not be sitting in something anyone with read access to the object can view directly. Kubernetes provides a near-identical component built specifically for this, the <strong>Secret</strong>: conceptually the same idea as a ConfigMap — external configuration attached to a Pod — but its values are stored base64-encoded rather than as plain text, and Kubernetes handles it as a distinct resource type with tighter conventions around access. It is worth being explicit here: base64 encoding is not encryption, and it is trivially reversible by anyone who can read the Secret object. A Secret keeps credentials out of your plain ConfigMaps and source code, with Kubernetes\'s own access controls providing the real protection around who can read that object in the first place — the encoding by itself is not a cryptographic guarantee.',
      'This lesson is only a conceptual overview: what ConfigMaps and Secrets are for, and how a Pod consumes them at a high level. A full hands-on demo — actually creating a ConfigMap and a Secret, wiring both into a running Pod as environment variables and as mounted files, and inspecting exactly how that data looks from inside the container — comes later, in this course\'s Configuration & Storage section. There is no need to worry about the exact commands or YAML syntax for creating either one yet.',
    ],
    keyPoints: [
      'A <strong>ConfigMap</strong> stores external, non-sensitive configuration (URLs, endpoint names, flags) outside of your application\'s image, so changing it does not require a rebuild.',
      'A <strong>Secret</strong> is used the same way, but for sensitive values (passwords, API keys, certificates) and stores them base64-encoded rather than as plain text.',
      '<strong><code>base64</code> is encoding, not encryption</strong> — it is trivially reversible; a Secret\'s real protection comes from Kubernetes\'s access controls around it, not the encoding itself.',
      'Both are attached to a Pod the same way, most commonly as environment variables or a mounted file inside the container.',
      'This is an overview only — creating and wiring up ConfigMaps and Secrets hands-on is covered in a full demo later, in the Configuration & Storage section.',
    ],
    code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DATABASE_URL: mongodb-service
  LOG_LEVEL: info
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
type: Opaque
data:
  DB_USERNAME: YWRtaW4=
  DB_PASSWORD: cGFzc3dvcmQ=`,
    codeLabel: 'yaml',
    note: {
      label: 'WHEN TO USE',
      text: 'Reach for a ConfigMap for anything you would be comfortable pasting into a public chat channel — URLs, flags, non-sensitive settings. The moment a value is a credential, certificate, or anything else that grants access to something, it belongs in a Secret instead.',
      tone: 'accent',
    },
    quiz: {
      question: 'A teammate stores a database password directly as plain data inside a ConfigMap instead of a Secret, reasoning that "it\'s external configuration either way." What is wrong with this?',
      options: [
        { label: 'Nothing — ConfigMaps and Secrets are functionally identical', correct: false },
        { label: 'ConfigMaps cannot store string values, only files', correct: false },
        { label: 'ConfigMap data is not base64-encoded or handled with the tighter access conventions Kubernetes applies to Secrets, so the password ends up stored and displayed as plain, readable text', correct: true },
        { label: 'Pods cannot read environment variables that come from a ConfigMap', correct: false },
      ],
      explanation: 'ConfigMaps are designed for non-sensitive settings and store their values as plain text with no special handling. Secrets exist specifically to hold sensitive values like credentials, storing them base64-encoded and treating the object with tighter access conventions — a password belongs there, not in a ConfigMap.',
    },
  },
  {
    id: '8.6',
    title: 'Benefits of Kubernetes: Scalability & High Availability',
    duration: '6 min',
    kind: 'theory',
    summary: [
      'Picture a small cluster made of two worker nodes, each running its own replica of an application Pod and a database Pod, with an Ingress component sitting in front of everything to handle incoming traffic. When a user\'s browser sends a request, it reaches the replicated Ingress first, which forwards it to the application\'s Service; that Service load-balances the request across whichever application Pod replicas are currently healthy. If handling that request requires a database read or write, the application Pod goes through the database\'s own Service in exactly the same way, which load-balances across the database Pod replicas. Every hop in that chain — Ingress, the application\'s Service, the database\'s Service — is itself replicated and load-balanced, so there is no single narrow point anywhere along the path that could slow down or halt the whole application by itself.',
      'This layered replication is what delivers both <strong>scalability</strong> and <strong>high availability</strong> at the same time. Scalability means handling more simultaneous users by increasing the number of Pod replicas sitting behind a Service; high availability means the system as a whole keeps serving traffic even when part of it fails. Scaling out is entirely declarative — you simply state how many replicas of a Pod you want, and the Deployment mechanism (the replicated-Pod manager introduced conceptually in an earlier lesson) takes care of actually creating or removing that many Pods and keeping the Service\'s load-balancing pool in sync automatically, with no manual provisioning of individual containers.',
      'To see the high-availability side concretely: if an entire worker node crashes — not just a single Pod, but the whole physical or virtual machine — every Pod replica that happened to be running on it goes down at once. Because the surviving node still has its own replica of both the application and the database Pods, users keep being served with no visible downtime, while the control plane\'s controller manager — reading the cluster\'s state from <code>etcd</code>, as covered in the architecture lesson — detects that the Pods are missing and schedules brand-new replacements onto a healthy node, quietly restoring full capacity in the background.',
      'One caveat carries over from the earlier overview lessons and is worth repeating here: none of this happens automatically just because an application happens to be running inside Kubernetes. Your application itself has to actually be designed to support running as multiple stateless replicas behind a load balancer — no assumption that it is the only running instance, and no unshared local state that other replicas cannot see. Kubernetes provides the replication and scheduling mechanism; correct application design is what actually lets you take advantage of it.',
    ],
    keyPoints: [
      'Every layer of a well-set-up cluster — Ingress, each Service, and the Pods behind it — is <strong>replicated and load-balanced</strong>, so there is no single narrow point that can bottleneck or take down the whole request path.',
      '<strong>Scalability</strong> means increasing the number of Pod replicas behind a Service to handle more load, declared rather than manually provisioned one server at a time.',
      '<strong>High availability</strong> means the application keeps serving traffic even if a whole worker node crashes, because surviving replicas on other nodes pick up the load.',
      'The <strong>controller manager</strong> detects the lost Pods (via <code>etcd</code>\'s cluster state) and automatically reschedules replacements onto a healthy node.',
      'Kubernetes supplies the replication and scheduling machinery, but your application still has to be designed to run safely as multiple stateless replicas for any of this to actually work.',
    ],
    note: {
      label: 'KEY INSIGHT',
      text: 'High availability in Kubernetes is not one single feature — it is the compounding effect of replicating and load-balancing every layer of the request path at once, from Ingress all the way down to the database Pods.',
      tone: 'green',
    },
    quiz: {
      question: 'Server 2 in a two-node cluster crashes entirely, taking down its application Pod replica and its database Pod replica with it. What keeps the application available to users in the meantime, and what happens next?',
      options: [
        { label: 'Nothing keeps it available; the whole application goes down until Server 2 is manually repaired', correct: false },
        { label: 'The Services on the surviving Server 1 keep routing traffic to its own healthy Pod replicas, while the controller manager schedules new replacements for the lost Pods elsewhere', correct: true },
        { label: 'Kubernetes automatically reboots Server 2 within seconds, so there is no real interruption to plan for', correct: false },
        { label: 'The application Pod on Server 1 automatically takes over Server 2\'s database data', correct: false },
      ],
      explanation: 'Because both the application and database Pods were replicated across two nodes, Server 1\'s own Pods keep serving traffic through their Services without interruption, while the controller manager detects the missing Pods from Server 2 and reschedules new replacements onto a healthy node in the background.',
    },
  },
  {
    id: '8.7',
    title: 'Benefits of Kubernetes: Self-Healing & Disaster Recovery',
    duration: '7 min',
    kind: 'theory',
    summary: [
      '<strong>Self-healing</strong> is a distinct scenario from the multi-node failure covered in the previous lesson: even on a perfectly healthy node, an individual Pod can crash entirely on its own — an application bug, running out of memory, anything at all. The controller manager continuously compares the desired state (for example, "there should be 3 replicas of this Pod") against <code>etcd</code>\'s record of the actual state, and the instant it detects a mismatch — a Pod that is supposed to exist but no longer does — it immediately asks the scheduler to place a replacement, which the target node\'s <code>kubelet</code> then starts. This detect-and-recover loop runs constantly and fully automatically, with no human needing to notice the crash or manually run a restart command — that continuous loop is exactly what "self-healing" means in Kubernetes.',
      '<code>etcd</code> has a second role beyond day-to-day cluster operation. Because it holds the complete, continuously updated state of the entire cluster — every Pod, every node\'s resources, every Service — it is also the foundation of <strong>disaster recovery</strong>. The standard administrator practice is to periodically take <code>etcd</code> snapshots — point-in-time backups of that key-value store — and copy them to remote storage that lives completely outside the cluster, such as cloud object storage or a separate on-premises location. Kubernetes itself does not do any of this automatically; scheduling and storing these backups is explicitly the cluster administrator\'s own responsibility, not a feature built into Kubernetes.',
      'It matters exactly what an <code>etcd</code> snapshot does and does not cover: it captures cluster state and metadata only, never your application\'s own data, such as the actual rows inside a database Pod. That data has to be backed up completely separately, typically by making sure the Pods holding it read and write to durable, remote storage outside the cluster in the first place, with its own independent backup strategy — the same "Kubernetes does not manage this, you do" principle already mentioned regarding persistent storage back in the very first Kubernetes components lesson.',
      'Put both pieces together and you get full disaster recovery: with reliable <code>etcd</code> snapshots and reliable application-data backups both stored outside the cluster, even a catastrophic failure of the <em>entire</em> cluster — every worker node and every master node gone at once — is recoverable. New master and worker nodes can be stood up from scratch, and the cluster\'s state restored from the <code>etcd</code> snapshot together with the separately backed-up application data, with the option of keeping a warm standby cluster ready ahead of time for a genuinely zero-downtime failover. It is worth closing with an honest comparison: none of this is literally exclusive to Kubernetes — similar replication, self-healing, and disaster-recovery behavior could be hand-built with something like AWS load balancers and auto-scaling groups. What Kubernetes actually offers is declarative replica counts, automatic self-healing, and intelligent scheduling (matching a Pod\'s resource needs against whichever of potentially dozens of nodes has room) bundled together as built-in behavior — which is a great deal less operational work than assembling the equivalent yourself.',
    ],
    keyPoints: [
      '<strong>Self-healing</strong>: the controller manager continuously compares desired vs. actual state using <code>etcd</code>, and automatically reschedules any Pod that disappears — no human has to notice or step in.',
      '<code>etcd</code> snapshots are point-in-time backups of <strong>cluster state and metadata</strong> — they must be copied to remote storage outside the cluster, and Kubernetes does not do this automatically; it is the administrator\'s job.',
      '<code>etcd</code> snapshots never include your <strong>application\'s own data</strong> (e.g. database rows) — that needs its own separate, independently managed backup strategy.',
      'With both <code>etcd</code> snapshots and application-data backups stored externally, an entire cluster — every master and worker node — can be rebuilt from scratch after a catastrophic failure.',
      'Kubernetes does not invent capabilities unavailable elsewhere (comparable replication is possible with, say, AWS load balancers) — it bundles replication, self-healing, and smart scheduling together as built-in, declarative behavior, which is far less manual effort than assembling the same thing yourself.',
    ],
    note: {
      label: 'WARNING',
      text: 'Kubernetes does not back up etcd or your application data for you. Both are explicitly the cluster administrator\'s own responsibility — a cluster that has been running for months without an etcd snapshot strategy has no real disaster recovery plan, no matter how self-healing it looks day to day.',
      tone: 'accent',
    },
    quiz: {
      question: 'A cluster administrator has been taking regular etcd snapshots and storing them in remote cloud storage, but has never separately backed up the data inside the cluster\'s database Pods. If the entire cluster is destroyed, what can actually be recovered?',
      options: [
        { label: 'Everything, including the database\'s own records, since etcd stores all cluster data', correct: false },
        { label: 'Only the cluster\'s structure and metadata (nodes, services, deployments, and so on) — the database\'s actual application data is not part of the etcd snapshot and is lost unless it was backed up separately', correct: true },
        { label: 'Nothing at all, since etcd snapshots are only useful while the original cluster is still running', correct: false },
        { label: 'Only the master nodes can be restored; all worker nodes and their pods are permanently lost', correct: false },
      ],
      explanation: 'etcd snapshots capture cluster state and metadata, not the data an application generates and stores inside its own Pods. Without a separate, independent backup of that application data, it is genuinely gone even though the cluster\'s structure can be fully rebuilt from the etcd snapshot.',
    },
  },
]
