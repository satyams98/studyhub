export default [
  {
    id: '11.1',
    title: 'How Containers Communicate Inside a Pod',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'Section 8 introduced Pods and Services as two of the core Kubernetes components, alongside Secrets and ConfigMaps. This section is the deep dive: how Pod networking actually works under the hood, every Service type in detail, and Ingress for routing HTTP traffic into the cluster. It starts here, at the smallest unit of all — the Pod itself — because everything else in this section is built on top of one fact about Pods that is easy to skim past the first time you hear it.',
      'The smallest deployable unit in Kubernetes is the Pod, not the container. To see why that abstraction exists at all, picture running containers directly on a single host without Kubernetes: each container binds an application port to a port on the host machine, and the host only has one of each port number to give out. Run a handful of containers this way and you can keep track of which host ports are free by hand. Run hundreds, across a fleet of microservices, and that bookkeeping becomes unmanageable — two teams inevitably try to claim the same host port, and someone\'s container refuses to start.',
      'Kubernetes solves this by giving every Pod its own dedicated network namespace and its own IP address, the same way your laptop has its own IP address distinct from every other machine on the network. Because a Pod is effectively its own tiny virtual host, ten different microservices can all listen on port <code>8080</code> inside ten different Pods, on the very same physical worker node, with zero port conflicts — each Pod owns its own private port space, and only the Pod\'s IP address (not a host port) is what the rest of the cluster uses to reach it. This single fact — <strong>every Pod gets a unique IP address that is reachable from every other Pod in the cluster</strong> — is the foundation that ClusterIP, NodePort, LoadBalancer, and Headless Services (the next three lessons) are all built on top of.',
      'Most Pods run exactly one container, but Kubernetes allows more — typically up to five or six — inside a single Pod. This is the "sidecar" pattern: a logging sidecar that ships the main container\'s logs to a central destination, a backup sidecar that snapshots a database on a schedule, or an authentication gateway sitting in front of the main application. These containers need tight, low-latency coupling to the main container, which is exactly what co-locating them in the same Pod provides: because all containers in one Pod share that Pod\'s single network namespace, they can reach each other simply via <code>localhost</code> and a port number — precisely like two ordinary processes running on your own laptop. A container in a different Pod cannot do this; it only has the other Pod\'s IP address to work with, or, better, a Service (the next lesson) in front of it.',
      'One more detail worth knowing before you see this in a real cluster: for every Pod, the container runtime silently creates an extra, minimal container called the "pause" container, whose only job is to hold the Pod\'s network namespace open. The real application containers attach themselves to that namespace rather than owning it directly. Because of this, if one application container inside a Pod crashes and gets restarted, the Pod keeps its IP address — the pause container never went away. Only when the entire Pod is deleted and recreated does Kubernetes assign it a brand-new IP address.',
    ],
    keyPoints: [
      'A Pod, not a container, is the smallest deployable unit in Kubernetes — giving each Pod its own IP address and port range avoids the host-level port allocation conflicts that plague running many containers directly on one machine.',
      'Every Pod gets a <strong>unique IP address reachable from every other Pod in the cluster</strong> — the foundational fact that ClusterIP, NodePort, LoadBalancer, and Headless Services all build on.',
      'Containers inside the <strong>same</strong> Pod share one network namespace and can talk to each other via <code>localhost:&lt;port&gt;</code>; containers in different Pods cannot.',
      'Multi-container ("sidecar") Pods are used when a helper process — a log shipper, a backup job, an auth gateway — needs tight, low-latency coupling to the main application container.',
      'A hidden "pause" container anchors each Pod\'s network namespace, so an app container can crash and restart without the Pod losing its IP address; only recreating the whole Pod assigns a new one.',
    ],
    code: `apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx-demo
spec:
  containers:
    - name: nginx-container
      image: nginx:1.25
      ports:
        - containerPort: 80
    - name: sidecar-container
      image: busybox:1.36
      command: ['sh', '-c', 'echo sidecar container started; sleep 300']`,
    codeLabel: 'yaml',
    note: {
      label: 'KEY INSIGHT',
      text: 'A Pod is not just "a container with extra steps" — it is a shared network namespace. Every container inside it behaves like just another process on the same tiny machine, which is exactly why plain localhost networking works between them.',
      tone: 'accent',
    },
    quiz: {
      question: 'Containers named `web` and `log-shipper` run inside the same Pod. `web` listens on port <code>8080</code>. What is the correct and simplest way for `log-shipper` to reach it?',
      options: [
        { label: 'It cannot be reached directly — a ClusterIP Service must sit in front of the Pod even for same-pod traffic', correct: false },
        { label: '`curl localhost:8080` — the containers share the Pod\'s network namespace, including its loopback interface', correct: true },
        { label: '`curl <pod-IP>:8080` from `log-shipper`, then hop through the node\'s own IP address', correct: false },
        { label: 'Only by mounting a shared Volume and writing the response to a file the other container polls', correct: false },
      ],
      explanation: 'Containers in the same Pod already share one network namespace, so localhost plus the container\'s own port reaches it directly — no Service, node-level hop, or shared volume required. Services exist to give a stable address to a set of Pods spread across the cluster; they solve a different problem than two containers that are already co-located in the same Pod.',
    },
  },
  {
    id: '11.2',
    title: 'ClusterIP: Internal Service Discovery',
    duration: '7 min',
    kind: 'concept',
    summary: [
      'Recall from the previous lesson that every Pod gets its own IP address — but Pods are also <em>ephemeral</em>. When a Pod crashes, gets rescheduled, or is replaced during a rolling update, its replacement gets a brand-new IP address. If your applications talked to each other using raw Pod IPs, you would have to update that configuration every single time a Pod was recreated — completely unworkable once you have more than a handful of replicas. This is exactly the gap the Service component, which you met briefly back in section 8, exists to close: a Service gives a group of Pods one stable, persistent address that never changes, no matter how many times the Pods behind it are destroyed and recreated. A Service also load-balances: if you run three replicas of an "orders" microservice, callers only ever need to know the Service\'s one address, and the Service spreads incoming requests across all three Pods behind it.',
      'A Service has a <code>type</code> field, and <code>ClusterIP</code> is the default — if you omit <code>type</code> entirely from a Service manifest, Kubernetes assumes ClusterIP for you. A ClusterIP Service is reachable <strong>only from inside the cluster</strong> — other Pods can call it, but nothing outside the cluster (a browser, an external system) can address it directly. The next lesson covers the two Service types that do expose traffic externally; for now, ClusterIP is what most Pod-to-Pod communication inside a cluster actually uses.',
      'A Service finds the Pods it should send traffic to using a <code>selector</code>: a set of key-value pairs that must match <strong>labels</strong> on the target Pods. Labels are just arbitrary tags you choose yourself — for example, a Deployment might stamp every Pod it creates with <code>app: orders</code> and <code>tier: backend</code> in that Pod\'s metadata. A Service whose selector lists those same two labels will automatically pick up every Pod carrying them, whether there is one replica or fifty, and will keep picking up new replicas (or dropping terminated ones) as the Deployment scales or restarts Pods over time — the Service is never told about individual Pod names, only about labels. Kubernetes tracks this matching automatically: creating a Service also creates an <code>Endpoints</code> object with the same name, which is kept continuously up to date with the current list of matching Pod IPs.',
      'Two ports matter in a Service definition, and confusing them is the single most common Service bug: <code>port</code> is the port the Service itself listens on — you choose this value arbitrarily, and it is what every caller uses to reach the Service. <code>targetPort</code>, by contrast, is <strong>not</strong> arbitrary — it must exactly match the port the application inside the container is actually listening on. Get this backwards, or leave it pointing at the wrong container port, and the Service will accept connections just fine while every request to it times out, because it is forwarding to a port nothing is listening on. If a Service needs to expose more than one port at once — say, the application\'s own traffic on one port and a metrics endpoint for Prometheus on another — every port must be explicitly named; a single-port Service can leave the name off. Finally, other Pods reach a ClusterIP Service simply by its <strong>name</strong>: Kubernetes\' internal DNS automatically resolves a Service name like <code>orders-service</code> to its ClusterIP address, so nothing ever has to hardcode an IP.',
    ],
    keyPoints: [
      '<code>ClusterIP</code> is the <strong>default Service type</strong> — reachable only from inside the cluster, never directly from external clients.',
      'A Service finds its Pods through a <code>selector</code> matching Pod <strong>labels</strong> (arbitrary key/value pairs you define) — never by Pod name, since Pod names and IPs change constantly.',
      'Kubernetes automatically creates and maintains an <code>Endpoints</code> object, sharing the Service\'s name, tracking exactly which Pod IPs currently match the selector.',
      '<code>port</code> is the Service\'s own, arbitrary port; <code>targetPort</code> must exactly match the port your application listens on inside the container — mismatching these is the #1 Service bug.',
      'A Service exposing more than one port must give each port a <code>name</code>.',
      'Other Pods reach a ClusterIP Service by its <strong>DNS name</strong> (e.g. <code>orders-service</code>) — Kubernetes\' internal DNS resolves it to the ClusterIP automatically, so nothing needs a hardcoded address.',
    ],
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: orders
      tier: backend
  template:
    metadata:
      labels:
        app: orders
        tier: backend
    spec:
      containers:
        - name: orders-container
          image: mycompany/orders-service:1.4.0
          ports:
            - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: orders-service
spec:
  type: ClusterIP
  selector:
    app: orders
    tier: backend
  ports:
    - port: 3200
      targetPort: 3000`,
    codeLabel: 'yaml',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Without a Service, every client, config file, and sidecar that needs to reach your app would have to track Pod IPs that change on every restart. ClusterIP gives you one name and one address that stays constant no matter how many times the underlying Pods are recreated.',
      tone: 'accent',
    },
    quiz: {
      question: 'A Deployment creates Pods labeled `app: orders, tier: backend`, listening on container port <code>3000</code>. Which Service definition correctly routes traffic to them on Service port <code>3200</code>?',
      options: [
        { label: 'selector: `app: orders, tier: frontend`; `port: 3200`; `targetPort: 3000`', correct: false },
        { label: 'selector: `app: orders, tier: backend`; `port: 3200`; `targetPort: 3000`', correct: true },
        { label: 'selector: `app: orders, tier: backend`; `port: 3000`; `targetPort: 3200`', correct: false },
        { label: 'No selector at all; just `port: 3200`, `targetPort: 3000`', correct: false },
      ],
      explanation: 'The selector must match every one of the Pod\'s actual labels exactly, and `targetPort` must equal the port the container really listens on (3000), while `port` is the Service\'s own arbitrary port (3200). The wrong selector value (option A) or a missing selector (option D) both leave the Service with no matching Pods at all, and swapping `port`/`targetPort` (option C) points the Service at a port nothing inside the container is listening on.',
    },
  },
  {
    id: '11.3',
    title: 'NodePort & LoadBalancer: Exposing Services Externally',
    duration: '7 min',
    kind: 'concept',
    summary: [
      'ClusterIP, from the previous lesson, is only reachable from inside the cluster — nothing external, like a browser, can address it directly. To let outside traffic in, Kubernetes offers two more Service types: <code>NodePort</code> and <code>LoadBalancer</code>. Neither is a wholly separate mechanism — each is literally built as a layer on top of the previous one. Creating a NodePort Service automatically creates a ClusterIP Service underneath it, and creating a LoadBalancer Service automatically creates a NodePort (and therefore a ClusterIP) underneath <em>that</em>. The full chain is <code>LoadBalancer → NodePort → ClusterIP</code>, each type a superset of the one before it.',
      'A <code>NodePort</code> Service opens the exact same static port on <strong>every worker node</strong> in the cluster, from a reserved range between <code>30000</code> and <code>32767</code> — the API server rejects any value outside that range. An external client hits <code>&lt;any-worker-node-IP&gt;:&lt;nodePort&gt;</code>, and Kubernetes internally forwards that request to the auto-created ClusterIP Service, which then load-balances it to one of the matching Pods — even a Pod running on a completely different node than the one the client happened to hit. That is a subtle but important point: because the NodePort is opened on every node, you can address <strong>any</strong> node\'s IP and still reach a healthy backend, regardless of which nodes actually have a replica scheduled on them. The tradeoff is that NodePort exposes worker node IP addresses and ports directly to the outside world, which is inefficient to manage at scale and not a good security posture — it is a tool for quick manual testing, not a production exposure strategy.',
      'A <code>LoadBalancer</code> Service is the standard production way to expose a single Service to the internet, but it only works when the cluster is running on a platform with native load-balancer support — AWS, Google Cloud, Azure, Linode, OpenStack, and similar providers all offer this. Creating a LoadBalancer Service asks Kubernetes to provision that provider\'s actual load balancer resource, which becomes the real external entry point with its own public IP. Traffic then flows: external client → cloud load balancer → the auto-created NodePort → the auto-created ClusterIP → a Pod. The advantage over configuring NodePort by hand is that you never expose node IPs directly, and the cloud handles the load balancer\'s own availability for you.',
      'One practical limitation worth flagging now, because the next two lessons address it directly: giving every microservice its own LoadBalancer Service means provisioning — and paying for — one cloud load balancer per Service, and none of them understand HTTP concepts like hostnames, URL paths, or TLS termination; they only forward raw TCP/UDP traffic. If you have several HTTP applications that should share one domain, or need host- or path-based routing, a single LoadBalancer in front of an Ingress (covered in lessons 11.5 and 11.6) is the far more common and cost-effective production pattern.',
    ],
    keyPoints: [
      '<strong>NodePort</strong> opens the same static port (range <code>30000–32767</code>) on every worker node; Kubernetes automatically creates a ClusterIP Service underneath it.',
      '<strong>LoadBalancer</strong> provisions your cloud provider\'s native load balancer (AWS/GCP/Azure/etc.) as the public entry point, and automatically creates a NodePort (which creates a ClusterIP) underneath it.',
      'The three Service types form a chain: <code>LoadBalancer → NodePort → ClusterIP</code> — each is a superset of the one before it.',
      'NodePort is fine for quick manual testing but is <strong>not recommended for production</strong> exposure — it opens worker node IPs and ports directly to external clients.',
      'LoadBalancer is the standard way to expose one Service publicly in the cloud, but one per microservice is costly and cannot do HTTP-level routing — the problem Ingress solves next.',
    ],
    code: `apiVersion: v1
kind: Service
metadata:
  name: orders-nodeport
spec:
  type: NodePort
  selector:
    app: orders
    tier: backend
  ports:
    - port: 3200
      targetPort: 3000
      nodePort: 31000
---
apiVersion: v1
kind: Service
metadata:
  name: orders-loadbalancer
spec:
  type: LoadBalancer
  selector:
    app: orders
    tier: backend
  ports:
    - port: 80
      targetPort: 3000`,
    codeLabel: 'yaml',
    note: {
      label: 'WARNING',
      text: 'NodePort opens a port directly on every worker node\'s own IP address, bypassing any centralized entry point. Treat it as a debugging convenience, never a production exposure strategy.',
      tone: 'accent',
    },
    quiz: {
      question: 'A team wants to expose their microservice to the public internet in a production AWS cluster. Which approach is most appropriate?',
      options: [
        { label: 'A NodePort Service, since it makes the app reachable on every worker node without any extra setup', correct: false },
        { label: 'A LoadBalancer Service (or an Ingress behind one shared LoadBalancer), so the app gets a stable public entry point without exposing node IPs directly', correct: true },
        { label: 'A ClusterIP Service, since it is the default type and therefore the most production-ready', correct: false },
        { label: 'A headless Service, since it gives clients direct access to every Pod replica', correct: false },
      ],
      explanation: 'NodePort works for demos but exposes raw node IPs and ports, which does not scale or secure well in production. ClusterIP is internal-only by design and cannot be reached from outside the cluster at all. A headless Service is for direct pod-to-pod addressing (next lesson), not public exposure. LoadBalancer — ideally with an Ingress behind a single shared LoadBalancer once you have more than one HTTP service — is the standard production pattern for public traffic on a cloud platform.',
    },
  },
  {
    id: '11.4',
    title: 'Headless Services',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'A normal ClusterIP Service, as covered in lesson 11.2, load-balances every request to one Pod chosen at random from the matching set — which is exactly the right behavior when any replica can answer any request equally well. That assumption breaks down for <strong>stateful</strong> applications like MySQL, MongoDB, or Elasticsearch, where Pod replicas are not interchangeable: one Pod might be the primary (or "master"), the only replica allowed to accept writes, while the others are read replicas that must synchronize from that specific primary. A write request randomly routed to whichever Pod a normal Service happens to pick could land on a read-only replica entirely by accident — and a newly started replica needs to connect to one specific, currently up-to-date peer to clone its data from, not to "whichever Pod answers first."',
      'This is a service-discovery problem: a client (or another Pod) needs to know the individual IP addresses of specific Pods, not just one shared virtual address. One option would be to call the Kubernetes API server directly and ask it for the list of Pods and their IPs, but that ties your application code tightly to the Kubernetes API and is inefficient to repeat on every connection. Kubernetes\' actual answer is DNS-based: normally, a DNS lookup of a Service\'s name returns a single IP address — the Service\'s own ClusterIP, the virtual address that gets load-balanced. A <strong>headless</strong> Service changes this by setting <code>clusterIP: None</code> in the Service spec, which tells Kubernetes not to allocate a virtual IP for it at all. With no virtual IP to hand back, Kubernetes\' DNS server instead returns the actual IP addresses of every individual Pod currently matching the selector — letting a client pick one specific Pod to talk to directly, or iterate over the full list itself.',
      'In practice, stateful applications are typically deployed with <strong>both</strong> services side by side: a normal ClusterIP Service for ordinary client traffic that is perfectly fine being load-balanced across any replica, plus a headless Service used specifically when something needs to reach one exact Pod — a worker Pod synchronizing from a specific master, or a monitoring tool like Prometheus that needs to scrape a metrics endpoint on <em>every</em> Pod individually rather than a randomly chosen one. Selectors, labels, and ports all work exactly the same way on a headless Service as on a normal one; the only difference is the missing virtual IP.',
    ],
    keyPoints: [
      'Headless Services exist for cases where a client needs to reach one <strong>specific</strong> Pod, not "any Pod matching the selector" — the typical situation with stateful apps like MySQL, MongoDB, or Elasticsearch.',
      'Set <code>clusterIP: None</code> in a Service\'s spec to make it headless — there is no separate <code>type: Headless</code> value.',
      'A DNS lookup against a normal ClusterIP Service returns one virtual IP; a DNS lookup against a headless Service returns the individual IP address of every matching Pod.',
      'Headless Services are commonly deployed <strong>alongside</strong> a normal ClusterIP Service for the same app — one for load-balanced traffic, one for direct, per-Pod addressing.',
      'Selectors, labels, and ports work identically to a normal Service — headless only removes the virtual IP allocation.',
    ],
    code: `apiVersion: v1
kind: Service
metadata:
  name: mongodb-service
spec:
  type: ClusterIP
  selector:
    app: mongodb
  ports:
    - port: 27017
      targetPort: 27017
---
apiVersion: v1
kind: Service
metadata:
  name: mongodb-headless
spec:
  clusterIP: None
  selector:
    app: mongodb
  ports:
    - port: 27017
      targetPort: 27017`,
    codeLabel: 'yaml',
    note: {
      label: 'WHEN TO USE',
      text: 'Reach for a headless Service only when a client genuinely needs to address individual Pods — direct master/worker replication, peer discovery, or per-pod metrics scraping. For ordinary request traffic, a normal ClusterIP Service\'s load balancing is what you want.',
      tone: 'green',
    },
    quiz: {
      question: 'Which setting in a Service spec makes it "headless," causing DNS lookups to return individual Pod IPs instead of one virtual IP?',
      options: [
        { label: '`type: Headless`', correct: false },
        { label: '`clusterIP: None`', correct: true },
        { label: '`selector: none`', correct: false },
        { label: 'An empty `ports: []` list', correct: false },
      ],
      explanation: 'There is no `Headless` Service type — `type` only accepts `ClusterIP`, `NodePort`, and `LoadBalancer` (plus `ExternalName`, not covered here). A Service becomes headless purely by explicitly setting `clusterIP: None`, which tells Kubernetes not to allocate a virtual IP at all, so DNS falls back to returning individual Pod IPs.',
    },
  },
  {
    id: '11.5',
    title: 'What Is Ingress & Why You Need It',
    duration: '7 min',
    kind: 'theory',
    summary: [
      'The previous lesson\'s LoadBalancer Service gets you a public IP address for one Service — fine when your cluster hosts exactly one application, but real systems rarely stop there. Imagine a UI application plus a couple of backend microservices, all needing to be reachable from browsers. Give each one its own LoadBalancer Service and you provision — and pay for — one cloud load balancer per Service, and none of them understand HTTP: they are raw TCP/UDP forwarders staring at an IP and a port, with no concept of hostnames, URL paths, or TLS certificates. There is no way to say "requests to <code>/api</code> go to the backend, requests to <code>/</code> go to the frontend" or "<code>app.example.com</code> goes here, <code>api.example.com</code> goes there." That exact gap is what Ingress fills.',
      'An Ingress is a Kubernetes API object — <code>kind: Ingress</code> — that declares HTTP(S) routing rules: for a given host (the domain name typed into a browser) and, optionally, a URL path, forward matching requests to a specific internal Service by name and port. The crucial detail the transcript for this lesson stresses is that an Ingress object <strong>does nothing by itself</strong>. Applying an Ingress manifest to the cluster does not start any process or spin up a load balancer — it is purely a declaration of routing intent. For those rules to actually take effect, the cluster needs an <strong>Ingress Controller</strong> running: an implementation, typically deployed as its own set of Pods, that continuously watches for Ingress objects, evaluates every rule defined anywhere in the cluster (even if there are fifty of them), and decides which rule applies to each incoming request. <code>ingress-nginx</code> is the most common community-maintained controller, though several third-party alternatives exist.',
      'Tracing the full path a request takes end to end: a browser request for a domain name first has to reach whatever is the actual network entry point into the cluster. In a managed cloud environment (AWS, GCP, and similar), that is usually a single cloud load balancer sitting in front of the Ingress Controller — notably, you provision just <strong>one</strong> cloud load balancer total, no matter how many Ingress rules or backend Services you define, which is the cost and operational win over a LoadBalancer Service per app. On a bare-metal or self-hosted cluster, there is no such built-in facility, so you must provide your own entry point — commonly an external reverse proxy server with a public IP that forwards traffic into the Ingress Controller. That also means none of the actual worker nodes need a publicly reachable IP address at all, which is a meaningful security improvement. Either way, once a request reaches the Ingress Controller, it evaluates the configured rules and hands the request to the correct internal ClusterIP Service, which load-balances it to a matching Pod exactly as covered in lesson 11.2.',
      'Two routing patterns come up constantly once you start writing real Ingress rules, and the next lesson builds both: <strong>host-based routing</strong>, where different domains or subdomains route to different backend Services (for example, <code>shop.example.com</code> versus <code>api.example.com</code>), and <strong>path-based routing</strong>, where one domain routes different URL paths to different Services (for example, <code>example.com/shopping</code> versus <code>example.com/analytics</code>) — the same technique behind a single Google account domain fronting Gmail, Calendar, and Analytics as separate underlying applications. Lesson 11.6 also covers TLS/HTTPS termination on an Ingress, which is the standard way production traffic actually reaches a cluster securely.',
    ],
    keyPoints: [
      'An Ingress resource declares HTTP(S) routing rules (host + path → backend Service); it is <strong>not itself a running process</strong> and does nothing without one.',
      'Rules only take effect once an <strong>Ingress Controller</strong> (e.g. <code>ingress-nginx</code>) is installed and running in the cluster to evaluate them.',
      'One LoadBalancer Service per application does not scale well and cannot do host- or path-based HTTP routing — Ingress solves both by putting a single entry point in front of many internal Services.',
      'In cloud environments, one cloud load balancer typically sits in front of the Ingress Controller; on bare metal, you provide your own entry point, such as an external reverse proxy.',
      'Ingress supports both <strong>host-based routing</strong> (different domains → different Services) and <strong>path-based routing</strong> (same domain, different paths → different Services).',
    ],
    code: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: orders-ingress
spec:
  rules:
    - host: orders.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: orders-service
                port:
                  number: 3200`,
    codeLabel: 'yaml',
    note: {
      label: 'KEY INSIGHT',
      text: 'Creating an Ingress object with no Ingress Controller running is like writing a routing table for a router that does not exist — kubectl will happily accept the YAML, but no traffic will ever actually be forwarded.',
      tone: 'accent',
    },
    quiz: {
      question: 'You apply a valid Ingress resource, but requests to its configured host never reach your Service. What is the most likely cause?',
      options: [
        { label: 'The Ingress needs a Deployment with the exact same name to bind to', correct: false },
        { label: 'No Ingress Controller is installed and running in the cluster to evaluate the rule', correct: true },
        { label: 'The backend Service must be of type LoadBalancer for Ingress to route to it', correct: false },
        { label: 'Ingress only works over HTTPS, not plain HTTP', correct: false },
      ],
      explanation: 'An Ingress resource is purely a declaration of routing rules — it requires a separate Ingress Controller (like ingress-nginx) running in the cluster to actually watch for and act on it. Backend Services normally stay ClusterIP behind an Ingress, with no LoadBalancer requirement, and plain HTTP ingress works fine without any TLS configured at all.',
    },
  },
  {
    id: '11.6',
    title: 'Configuring an Ingress Resource',
    duration: '9 min',
    kind: 'demo',
    summary: [
      'Getting Ingress working in a cluster is always a two-step process, and skipping the first step is the most common reason a fresh Ingress setup silently does nothing. Step one is installing an Ingress Controller. On Minikube, this is a single command: <code>minikube addons enable ingress</code> automatically deploys the <code>ingress-nginx</code> controller as a Pod into the <code>kube-system</code> namespace — confirm it is running with <code>kubectl get pod -n kube-system</code>. A real production cluster typically installs the same <code>ingress-nginx</code> controller via a Helm chart, or uses a cloud provider\'s managed equivalent, but the end result is identical: an Ingress Controller Pod running and watching for Ingress objects. Step two is writing and applying the actual Ingress resource, shown below, which maps the host <code>orders.example.com</code> to the <code>orders-service</code> ClusterIP Service from lesson 11.2, on its Service port <code>3200</code>.',
      'After applying an Ingress, run <code>kubectl get ingress</code> and watch the <code>ADDRESS</code> column — it starts out empty and fills in a few seconds later, once the controller finishes assigning its own entry-point address to that rule. For local testing without real DNS, map the hostname to that address in your machine\'s hosts file (on Windows, <code>C:\\Windows\\System32\\drivers\\etc\\hosts</code>); in a real deployment you would instead create an actual DNS record pointing at the Ingress Controller\'s load balancer address. Once that mapping exists, requests to <code>orders.example.com</code> resolve locally, reach the Ingress Controller, get matched against the rule below, and are forwarded to the internal Service exactly as described in the previous lesson.',
      'Ingress also has a built-in fallback: whenever a request arrives at a host or path that matches <strong>no</strong> configured rule, the controller routes it to a <strong>default backend</strong>, visible by running <code>kubectl describe ingress orders-ingress</code>. Out of the box this returns a generic "404 not found" response. You can override it with your own Service and Pod, named to match what the controller expects as its default backend, so users see a custom, on-brand error page instead of a bare 404.',
      'Real Ingress configurations go further than a single host and path. <strong>Path-based routing</strong> keeps one <code>host</code> and lists multiple entries under <code>paths</code>, each pointing at a different backend Service — the manifest below adds an <code>/admin</code> path alongside the default <code>/</code> path, routing to a separate <code>orders-admin-service</code>. <strong>Host-based routing</strong> instead adds additional entries to the top-level <code>rules</code> array, each with its own <code>host</code> and a single path — for example, a second rule for <code>admin.example.com</code> in place of the <code>/admin</code> path. Finally, TLS/HTTPS termination is configured with a <code>tls</code> block placed above <code>rules</code>, referencing a Kubernetes <code>Secret</code> of type <code>kubernetes.io/tls</code> that holds the certificate and key. Three details matter here: the Secret\'s data keys must be named exactly <code>tls.crt</code> and <code>tls.key</code>; their values are the full, base64-encoded file contents, never a file path; and the Secret must live in the <strong>same namespace</strong> as the Ingress referencing it — namespaces are covered in depth in the next section.',
    ],
    keyPoints: [
      'Installing an Ingress resource is step two of two — step one is having an Ingress Controller running (<code>minikube addons enable ingress</code> locally, or a Helm-installed <code>ingress-nginx</code> in a real cluster).',
      'After creating an Ingress, watch <code>kubectl get ingress</code> until an <code>ADDRESS</code> is assigned — that is the entry-point address your DNS (or local hosts file, for testing) should point to.',
      '<strong>Path-based routing</strong> uses one <code>host</code> with multiple entries in <code>paths</code>; <strong>host-based routing</strong> uses multiple entries in <code>rules</code>, each with its own <code>host</code>.',
      'Requests matching no configured rule fall through to the Ingress Controller\'s <strong>default backend</strong>, which normally returns a generic 404 — override it with your own Service for a custom error page.',
      'TLS termination is configured with a <code>tls</code> block referencing a Secret of type <code>kubernetes.io/tls</code>. Its <code>tls.crt</code>/<code>tls.key</code> keys hold full, base64-encoded file contents, and the Secret must live in the <strong>same namespace</strong> as the Ingress — the subject of the next section.',
    ],
    code: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: orders-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  tls:
    - hosts:
        - orders.example.com
      secretName: orders-tls-secret
  rules:
    - host: orders.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: orders-service
                port:
                  number: 3200
          - path: /admin
            pathType: Prefix
            backend:
              service:
                name: orders-admin-service
                port:
                  number: 3300
---
apiVersion: v1
kind: Secret
metadata:
  name: orders-tls-secret
  namespace: default
type: kubernetes.io/tls
data:
  tls.crt: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUZEekNDQXZlZ0F3SUJBZ0lVYXpsMGZUUWtOOEdrTGhKZ2h6VjBOOHZQVXVjd0RRWUpLb1pJaHZjTkFRRUxCUUF3RmpFVU1CSUdBMVVFQXd3TGIzSmtaWEpsY2k1amIyMD0K
  tls.key: LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRQ3lyT3JmMmhhVEZWTHk9Cg==`,
    codeLabel: 'yaml',
    note: {
      label: 'DECISION POINT',
      text: 'Choose path-based routing (<code>myapp.com/orders</code>, <code>myapp.com/admin</code>) when features belong to one product on one domain; choose host-based routing (<code>orders.myapp.com</code>, <code>admin.myapp.com</code>) when they are independently versioned, scaled, or owned by a different team.',
      tone: 'accent',
    },
    quiz: {
      question: 'An Ingress references a TLS secret named `orders-tls-secret`, but TLS negotiation fails with a "secret not found" style error, even though `kubectl get secret orders-tls-secret -n backend-team` shows the secret exists. What is the likely cause?',
      options: [
        { label: 'The Ingress and the Secret must live in the same namespace, and the Ingress is not in `backend-team`', correct: true },
        { label: 'TLS secrets can only be referenced by IP address, not by name', correct: false },
        { label: 'The secret must be of type `Opaque`, not `kubernetes.io/tls`', correct: false },
        { label: '`tls.crt` and `tls.key` must be stored as plain text, not base64-encoded', correct: false },
      ],
      explanation: 'An Ingress can only reference a Secret sitting in its own namespace — Kubernetes does not support cross-namespace Secret references. The type must be `kubernetes.io/tls` (not `Opaque`) for Kubernetes to recognize it as a TLS secret, and its data values are base64-encoded file contents, never plain text or an IP address reference.',
    },
  },
]
