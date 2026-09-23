export default [
  {
    id: '10.1',
    title: 'Why Declarative YAML? Imperative vs Declarative',
    duration: '7 min',
    kind: 'theory',
    summary: [
      'Every command used so far — <code>kubectl create deployment ... --image=...</code>, <code>kubectl edit deployment</code> — is <strong>imperative</strong>: a one-off instruction that tells Kubernetes exactly what action to take, right now. That style is fine for a quick experiment, but it breaks down fast in practice. As soon as a Deployment needs more than a name and an image — a replica count, environment variables, volume mounts, resource limits, health checks — there is no clean way to express all of that as command-line flags. And even if you managed it, the command itself is never saved anywhere; it disappears from history the moment you move on.',
      'The alternative is <strong>declarative</strong> configuration: instead of telling Kubernetes what action to take, you describe the <em>desired end state</em> of a resource in a plain-text YAML file, and hand that file to Kubernetes with <code>kubectl apply -f</code>. Kubernetes does not just create the resource once and forget about it. It continuously compares the actual state of the cluster — the <strong>status</strong> — against the state you declared — the <strong>spec</strong> — and works to reconcile any difference between the two. That reconciliation loop is what "self-healing" actually means in practice: if you declare 3 replicas and the node running one of those pods crashes, the actual count drops to 2, Kubernetes notices the mismatch against your declared spec, and it creates a replacement pod automatically, with no command from you.',
      'The data that reconciliation loop compares against lives in <code>etcd</code>, the cluster\'s data store, running on the control-plane node(s). Every controller in Kubernetes is constantly reading the desired spec and writing the observed status there, which is also how a status field shows up automatically the moment you fetch a live resource\'s manifest — Kubernetes has already recorded it in etcd by the time you ask.',
      'There is also a very practical, everyday benefit: because manifests are just text files, the standard practice is to commit them to the same git repository as your application code, often called infrastructure as code. That gives you a reviewable diff every time configuration changes, a full history of who changed what and when, and a way to recreate the exact same setup from scratch — none of which a one-off terminal command can offer.',
    ],
    keyPoints: [
      'Imperative commands (<code>kubectl create ...</code>, <code>kubectl edit ...</code>) are fine for quick experiments but cannot cleanly express complex configuration and leave no reusable record of what happened.',
      'Declarative YAML describes the <strong>desired state</strong> once; <code>kubectl apply -f file.yaml</code> creates the resource if it is missing or updates it if it already exists — the same command works both times.',
      'Kubernetes continuously reconciles a resource\'s actual <strong>status</strong> against its declared <strong>spec</strong>; this reconciliation loop is the mechanism behind self-healing.',
      'The cluster\'s current status lives in <code>etcd</code> on the control plane, which every controller reads from and writes to.',
      'Because manifests are plain text, standard practice is to commit them to the same git repository as your application code.',
    ],
    code: `# Imperative -- one-off, hard to extend, nothing saved anywhere
kubectl create deployment nginx-depl --image=nginx

# Declarative -- desired state lives in a file, safe to re-run,
# and Kubernetes reconciles reality to match it
kubectl apply -f nginx-deployment.yaml`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: 'Self-healing is not magic. It is Kubernetes repeatedly diffing your YAML\'s spec against the live status stored in etcd, and issuing whatever create or delete calls are needed to close the gap.',
      tone: 'accent',
    },
    quiz: {
      question: 'A Deployment declares replicas: 3 in its YAML. One pod\'s node crashes, dropping the actual running count to 2. What happens next, and why?',
      options: [
        { label: 'Kubernetes automatically creates a new pod because it continuously reconciles actual status against the declared spec', correct: true },
        { label: 'Nothing happens until you manually run kubectl apply again', correct: false },
        { label: 'The Deployment automatically edits its own YAML to lower replicas to 2', correct: false },
        { label: 'You must manually run kubectl create pod to replace the missing one', correct: false },
      ],
      explanation: 'The reconciliation loop runs continuously, not just when you type a command. It notices the drop to 2 running pods against a declared spec of 3 and creates a replacement immediately, which is exactly what self-healing means in practice.',
    },
  },
  {
    id: '10.2',
    title: 'Anatomy of a Deployment Manifest',
    duration: '9 min',
    kind: 'concept',
    summary: [
      'Every Kubernetes manifest, no matter what kind of resource it describes, is built from the same three top-level parts. <strong>metadata</strong> holds the resource\'s identity — its name, labels, and other bookkeeping. <strong>spec</strong> holds everything you actually configure — this is the part you write by hand. <strong>status</strong> is auto-generated by Kubernetes from etcd, reflecting the real current state; you never write this yourself, but if you fetch a live resource with <code>kubectl get -o yaml</code>, you will see Kubernetes has appended it for you. The very first two lines of any manifest, <code>apiVersion</code> and <code>kind</code>, tell Kubernetes which type of object and which API schema version you are describing — Deployments use <code>apps/v1</code>.',
      'Inside a Deployment\'s <code>spec</code>, three fields do almost all the work. <code>replicas</code> is simply how many identical pods you want running at once. <code>selector.matchLabels</code> is how the Deployment recognizes which running pods are "its own" — it must match, exactly, the labels defined on the pod template below it. <code>template</code> is a full Pod specification nested inside the Deployment\'s specification — literally a manifest within a manifest — because the Deployment needs a complete blueprint describing exactly what kind of pod it should stamp out.',
      'The labels/selector mechanism is worth being precise about, because it reappears identically for Services in the next lesson. <code>metadata.labels</code> on the pod template attaches an arbitrary key-value tag — for example <code>app: nginx</code> — to every pod created from that template. <code>spec.selector.matchLabels</code> on the Deployment tells it which label to search for, so it knows which pods currently running in the cluster belong to it. If those two label sets do not match exactly, the Deployment cannot find its own pods, and Kubernetes will reject the manifest outright.',
      'One level deeper, inside <code>template.spec.containers</code>, sits the container-level configuration: <code>name</code>, <code>image</code>, and <code>ports</code>. The <code>containerPort</code> value documents which port the application inside the container listens on. It is worth being clear that this by itself does not expose anything outside the pod — it is informational, read by other parts of the system such as a Service\'s <code>targetPort</code>, which is exactly what the next lesson covers.',
    ],
    keyPoints: [
      'Every manifest has three top-level parts: <code>metadata</code> (identity), <code>spec</code> (desired configuration), and an auto-generated <code>status</code> you never write by hand.',
      '<code>apiVersion</code> and <code>kind</code> — the first two lines — tell Kubernetes which resource type and API schema to use; Deployments use <code>apps/v1</code>.',
      '<code>spec.replicas</code> sets how many identical pods should exist; <code>spec.selector.matchLabels</code> must exactly match <code>spec.template.metadata.labels</code>, or the Deployment cannot find its own pods.',
      '<code>spec.template</code> is a full Pod specification nested inside the Deployment\'s specification — the blueprint used to stamp out every pod.',
      '<code>containerPort</code> under <code>spec.template.spec.containers[].ports</code> documents which port the app listens on inside the container; it does not by itself expose anything outside the pod.',
    ],
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.16
          ports:
            - containerPort: 80`,
    codeLabel: 'yaml',
    note: {
      label: 'WARNING',
      text: 'If spec.selector.matchLabels does not exactly match spec.template.metadata.labels, kubectl apply will reject the manifest with a selector error. This mismatch is one of the most common beginner mistakes when hand-writing a Deployment.',
      tone: 'accent',
    },
    quiz: {
      question: 'In a Deployment manifest, why must spec.selector.matchLabels and spec.template.metadata.labels use the same key-value pair?',
      options: [
        { label: 'Because the Deployment uses that label to identify which running pods it owns and must manage', correct: true },
        { label: 'They are purely cosmetic and can differ freely', correct: false },
        { label: 'Kubernetes auto-generates matchLabels from the container image name', correct: false },
        { label: 'The label controls which node the pod is scheduled on', correct: false },
      ],
      explanation: 'The selector is the only mechanism a Deployment has for recognizing its own pods among everything else running in the cluster. A mismatch means the Deployment cannot find the pods it should own, which is why Kubernetes validates and rejects a manifest where the two do not agree.',
    },
  },
  {
    id: '10.3',
    title: 'Anatomy of a Service Manifest',
    duration: '9 min',
    kind: 'concept',
    summary: [
      'Pods are ephemeral — every time one is recreated, whether from a rolling update or a crash, it gets a brand-new internal IP address. That means nothing should ever talk to a pod directly by its IP. A <strong>Service</strong> solves this by giving a stable, unchanging address in front of a group of pods, and load-balancing requests across whichever of those pods are currently healthy, regardless of how many times the pods underneath have been replaced.',
      'A Service\'s <code>spec.selector</code> uses the exact same labels mechanism introduced for Deployments in the last lesson, just applied to a different purpose: it tells the Service which pods to send traffic to, matched directly against the pods\' own <code>metadata.labels</code> — not against the Deployment\'s labels. This selector is, in fact, the <em>only</em> connection between a Service and the pods behind it; there is no other reference linking the two objects together.',
      'Inside <code>spec.ports</code>, two numbers matter and are easy to confuse: <code>port</code> is where the Service itself is reachable — the port other things send their requests to. <code>targetPort</code> is the port on the pod the request actually gets forwarded to once it reaches the Service, and it must equal the container\'s own <code>containerPort</code> from the previous lesson. Because these two numbers are independently configurable, you can expose a Service on port 80 while the container behind it listens on port 8081, for example.',
      'Finally, <code>type</code> controls how reachable the Service is from outside the cluster. <code>ClusterIP</code> is the default when <code>type</code> is omitted entirely, and it is internal-only — reachable only from other pods and services inside the cluster, which is exactly right for something like a database. <code>NodePort</code> adds a third port, <code>nodePort</code>, which must fall in the <strong>30000–32767</strong> range, making the Service reachable from outside the cluster via any node\'s IP address on that port. <code>LoadBalancer</code> does everything <code>NodePort</code> does, plus it requests a real external IP address from the cloud provider — on Minikube, since there is no cloud provider to fulfil that request, it stays <code>&lt;pending&gt;</code> forever, which is why <code>minikube service &lt;name&gt;</code> exists as a local stand-in.',
    ],
    keyPoints: [
      '<code>spec.selector</code> on a Service is matched against pod <code>labels</code> — this is the only link between a Service and the pods it routes traffic to.',
      '<code>port</code> is where the Service itself is reachable; <code>targetPort</code> is the port on the pod the request is forwarded to, and it must equal the container\'s <code>containerPort</code>.',
      '<code>type: ClusterIP</code> (the default when type is omitted) is internal-only — reachable only from other pods or services inside the cluster.',
      '<code>type: NodePort</code> adds a <code>nodePort</code> (must fall in the <strong>30000–32767</strong> range) that makes the Service reachable from outside the cluster via any node\'s IP.',
      '<code>type: LoadBalancer</code> additionally requests a real external IP from the cloud provider; on Minikube this stays <code>&lt;pending&gt;</code> since there is no cloud provider to fulfil it, so <code>minikube service &lt;name&gt;</code> is used to reach it locally instead.',
    ],
    code: `# Internal service -- only reachable from inside the cluster
apiVersion: v1
kind: Service
metadata:
  name: mongo-service
spec:
  selector:
    app: mongo
  ports:
    - protocol: TCP
      port: 27017
      targetPort: 27017
---
# External service -- reachable from a browser outside the cluster
apiVersion: v1
kind: Service
metadata:
  name: mongo-express-service
spec:
  selector:
    app: mongo-express
  type: LoadBalancer
  ports:
    - protocol: TCP
      port: 8081
      targetPort: 8081
      nodePort: 30000`,
    codeLabel: 'yaml',
    note: {
      label: 'DECISION POINT',
      text: 'Choose ClusterIP for anything only other pods should reach, like a database. Reach for NodePort or LoadBalancer only for the handful of services that real users or browsers need to hit directly.',
      tone: 'accent',
    },
    quiz: {
      question: 'A pod\'s container listens on port 8081. The Service\'s spec sets port: 80. What value must targetPort have for requests to actually reach the container?',
      options: [
        { label: '8081', correct: true },
        { label: '80', correct: false },
        { label: '27017', correct: false },
        { label: 'targetPort is optional and can be left out', correct: false },
      ],
      explanation: 'port and targetPort are independent numbers. port is where the Service listens for incoming requests; targetPort is where it forwards those requests, and it must match the container\'s actual listening port, which here is 8081, regardless of what port the Service itself is exposed on.',
    },
  },
  {
    id: '10.4',
    title: 'Applying Manifests with kubectl apply',
    duration: '8 min',
    kind: 'demo',
    summary: [
      'Applying the Deployment and Service manifests from the last two lessons with <code>kubectl apply -f nginx-deployment.yaml</code> reports both resources as <code>created</code> the first time. Running the exact same command again, with nothing changed in the file, reports <code>unchanged</code> for both. That is the practical proof that <code>apply</code> is idempotent — applying an unchanged file repeatedly has no side effects, which is exactly the property that makes it safe to run from an automated pipeline on every deploy, not just by hand.',
      'The update path looks almost identical. Change <code>spec.replicas</code> from 2 to 3 directly in the local YAML file and re-run <code>kubectl apply -f</code>. Kubernetes detects the difference between your file and its own stored state, reports <code>configured</code> this time instead of <code>unchanged</code>, and a third pod appears in <code>kubectl get pod</code> without touching the two pods that already existed. This is the declarative twin of <code>kubectl edit</code> from Section 9 — the same underlying mechanism, but now the source of truth is a file you control and can commit to git, not a live edit that only ever existed inside the cluster.',
      '<code>kubectl get &lt;resource&gt; &lt;name&gt; -o yaml</code> shows exactly what Kubernetes actually stored, which includes everything you wrote plus a long list of fields Kubernetes generated on its own — <code>creationTimestamp</code>, <code>resourceVersion</code>, and a unique <code>uid</code> in metadata, defaulted fields inside spec, and the entire <code>status</code> block. This matters practically: if you ever want to reuse a live resource\'s exported YAML as a starting template for something new, you have to strip these generated fields first, or applying the file can fail or behave unexpectedly, since it now looks like an attempt to overwrite an existing, specific object rather than declare a new one.',
      '<code>kubectl delete -f &lt;file&gt;</code> is the mirror image of <code>apply</code>: it deletes every resource declared in that file in one command, instead of deleting resources one at a time by name. Between <code>apply -f</code> and <code>delete -f</code>, the YAML file becomes the single artifact you use to manage a resource\'s entire lifecycle.',
    ],
    keyPoints: [
      '<code>kubectl apply -f &lt;file&gt;</code> is idempotent: re-running it with no changes reports <code>unchanged</code>; it only reports <code>configured</code> when your local file\'s spec actually differs from the cluster\'s.',
      'Editing the source YAML file and re-applying is the declarative equivalent of <code>kubectl edit</code> — the difference is the change now lives in a file you can commit, review, and re-run.',
      '<code>kubectl get &lt;resource&gt; &lt;name&gt; -o yaml</code> shows the live manifest Kubernetes actually stored, including auto-generated fields like <code>creationTimestamp</code>, <code>resourceVersion</code>, and the full <code>status</code> block.',
      'To reuse a live resource\'s exported YAML as a template for something new, strip the auto-generated metadata/status fields first — applying them as-is can conflict with the existing object.',
      '<code>kubectl delete -f &lt;file&gt;</code> deletes every resource declared in that file in one command, mirroring how <code>apply</code> creates or updates them all at once.',
    ],
    code: `kubectl apply -f nginx-deployment.yaml
# deployment.apps/nginx-deployment created
# service/nginx-service created

# Run it again with no changes:
kubectl apply -f nginx-deployment.yaml
# deployment.apps/nginx-deployment unchanged
# service/nginx-service unchanged

# Edit the file: bump replicas from 2 to 3, then re-apply
kubectl apply -f nginx-deployment.yaml
# deployment.apps/nginx-deployment configured
# service/nginx-service unchanged

kubectl get pod
# NAME                            READY   STATUS    RESTARTS   AGE
# nginx-deployment-6c9-4f2xk      1/1     Running   0          4m
# nginx-deployment-6c9-9j7pl      1/1     Running   0          4m
# nginx-deployment-6c9-2plkq      1/1     Running   0          10s

# Inspect exactly what Kubernetes stored, including auto-generated fields
kubectl get deployment nginx-deployment -o yaml > nginx-deployment-result.yaml

# Delete every resource declared in the file, in one shot
kubectl delete -f nginx-deployment.yaml
# deployment.apps "nginx-deployment" deleted
# service "nginx-service" deleted`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'unchanged vs configured is Kubernetes telling you, in plain words, whether your file and the live cluster already agree. That feedback is exactly what makes apply safe to run over and over, including from a CI/CD pipeline on every deploy.',
      tone: 'green',
    },
    quiz: {
      question: 'You run kubectl apply -f app.yaml twice in a row without editing the file in between. What does the second run report?',
      options: [
        { label: 'unchanged, for every resource declared in the file', correct: true },
        { label: 'An error, since the resources already exist', correct: false },
        { label: 'configured, because apply always reapplies everything from scratch', correct: false },
        { label: 'created, because apply always recreates resources on every run', correct: false },
      ],
      explanation: 'apply compares your file against the cluster\'s current state and only reports configured when there is an actual difference to reconcile. With no changes, it reports unchanged and takes no action, which is exactly what makes it safe to run repeatedly.',
    },
  },
  {
    id: '10.5',
    title: 'End-to-End: Deploying a Full Application',
    duration: '14 min',
    kind: 'demo',
    summary: [
      'This lesson deploys a realistic two-tier application: MongoDB as the database, and mongo-express as a web-based admin UI in front of it. The same pattern applies to essentially any application-plus-database pairing. Before writing any YAML, it helps to lay out the full request flow: an external Service exposes mongo-express to a browser, which forwards to the mongo-express pod, which connects to an internal Service in front of MongoDB, which forwards to the MongoDB pod. Two separate Services exist because one of them needs to be reachable from outside the cluster and the other should never be — exactly the <code>LoadBalancer</code> versus <code>ClusterIP</code> distinction from the previous lesson.',
      'Credentials and configuration are deliberately kept out of the Deployment YAML files themselves. Since manifests get committed to git, a plaintext database password sitting in a Deployment\'s spec would leak straight into source control the moment someone pushes it. A <strong>Secret</strong> holds the MongoDB root username and password instead — note that Secret values must be <strong>base64-encoded</strong> (using something like <code>echo -n \'value\' | base64</code>), and it is worth being precise that base64 is an encoding, not encryption; it is simply how the Secret API stores arbitrary byte values safely inside YAML text. A <strong>ConfigMap</strong> holds the non-sensitive MongoDB connection URL, which in this case is nothing more than the internal Service\'s own name — Kubernetes automatically gives every Service a cluster-internal DNS name equal to its own <code>metadata.name</code>, resolvable from any pod in the cluster. Both objects are referenced from the Deployment\'s environment variables through <code>secretKeyRef</code> and <code>configMapKeyRef</code>, rather than literal values.',
      'The build order matters and is worth internalizing: a Secret or ConfigMap must exist in the cluster <em>before</em> any Deployment that references it, or the container referencing it will fail to start, since the environment variable it depends on cannot be resolved yet. The practical sequence is therefore: apply the Secret, then the ConfigMap, then the MongoDB Deployment and its internal Service, verifying the pod reaches <code>Running</code> at each step, then finally the mongo-express Deployment and its external Service. Checking <code>kubectl logs</code> on the mongo-express pod once it is running should show a line confirming the database connected successfully, proving the whole chain — Secret, ConfigMap, and both Services — is wired correctly.',
      'Because a <code>LoadBalancer</code> Service\'s external IP stays <code>&lt;pending&gt;</code> forever on Minikube (there is no cloud provider to hand out a real one), <code>minikube service mongo-express-service</code> is used to reach it instead — it opens a browser tunnel using the node\'s own IP and the configured <code>nodePort</code>, standing in for what a cloud load balancer would normally provide.',
    ],
    keyPoints: [
      'Sensitive values (usernames, passwords) belong in a <strong>Secret</strong>; non-sensitive shared configuration (like a connection URL) belongs in a <strong>ConfigMap</strong> — neither should be hardcoded into a Deployment\'s YAML.',
      'Secret values must be <strong>base64-encoded</strong> (<code>echo -n \'value\' | base64</code>) — this is encoding for safe storage in YAML, not encryption.',
      'A Deployment references a Secret or ConfigMap value with <code>valueFrom.secretKeyRef</code> / <code>valueFrom.configMapKeyRef</code>, naming the object and the specific key inside it.',
      'Kubernetes gives every Service a cluster-internal DNS name equal to its own <code>metadata.name</code> — that is literally what a "database URL" pointing at an internal service resolves to.',
      'Order matters: apply a Secret/ConfigMap <strong>before</strong> any Deployment that references it, or the dependent container fails to start.',
      'On Minikube, a <code>LoadBalancer</code> Service\'s external IP stays <code>&lt;pending&gt;</code> forever; <code>minikube service &lt;name&gt;</code> is the local stand-in that opens it in a browser anyway.',
    ],
    code: `# --- Secret: MongoDB root credentials (values are base64-encoded) ---
# echo -n 'admin' | base64        -> YWRtaW4=
# echo -n 'password123' | base64  -> cGFzc3dvcmQxMjM=
apiVersion: v1
kind: Secret
metadata:
  name: mongo-secret
type: Opaque
data:
  mongo-root-username: YWRtaW4=
  mongo-root-password: cGFzc3dvcmQxMjM=
---
# --- MongoDB Deployment ---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongo-deployment
  labels:
    app: mongo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongo
  template:
    metadata:
      labels:
        app: mongo
    spec:
      containers:
        - name: mongodb
          image: mongo:5.0
          ports:
            - containerPort: 27017
          env:
            - name: MONGO_INITDB_ROOT_USERNAME
              valueFrom:
                secretKeyRef:
                  name: mongo-secret
                  key: mongo-root-username
            - name: MONGO_INITDB_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mongo-secret
                  key: mongo-root-password
---
# --- MongoDB internal Service ---
apiVersion: v1
kind: Service
metadata:
  name: mongo-service
spec:
  selector:
    app: mongo
  ports:
    - protocol: TCP
      port: 27017
      targetPort: 27017
---
# --- ConfigMap: non-sensitive connection info ---
apiVersion: v1
kind: ConfigMap
metadata:
  name: mongo-configmap
data:
  database_url: mongo-service
---
# --- mongo-express Deployment ---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongo-express-deployment
  labels:
    app: mongo-express
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongo-express
  template:
    metadata:
      labels:
        app: mongo-express
    spec:
      containers:
        - name: mongo-express
          image: mongo-express:1.0
          ports:
            - containerPort: 8081
          env:
            - name: ME_CONFIG_MONGODB_ADMINUSERNAME
              valueFrom:
                secretKeyRef:
                  name: mongo-secret
                  key: mongo-root-username
            - name: ME_CONFIG_MONGODB_ADMINPASSWORD
              valueFrom:
                secretKeyRef:
                  name: mongo-secret
                  key: mongo-root-password
            - name: ME_CONFIG_MONGODB_SERVER
              valueFrom:
                configMapKeyRef:
                  name: mongo-configmap
                  key: database_url
---
# --- mongo-express external Service ---
apiVersion: v1
kind: Service
metadata:
  name: mongo-express-service
spec:
  selector:
    app: mongo-express
  type: LoadBalancer
  ports:
    - protocol: TCP
      port: 8081
      targetPort: 8081
      nodePort: 30000`,
    codeLabel: 'yaml',
    note: {
      label: 'WARNING',
      text: 'Applying the mongo-express Deployment before the Secret and ConfigMap exist leaves its pod stuck failing to start, since the environment variables it references cannot be resolved yet. Always create the dependencies first.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is the MongoDB connection URL passed to mongo-express as mongo-service (the Service\'s name) rather than a pod IP address?',
      options: [
        { label: 'Kubernetes gives every Service a stable, cluster-internal DNS name equal to its metadata.name, while pod IPs change every time a pod is recreated', correct: true },
        { label: 'Pod IP addresses are not allowed inside environment variables', correct: false },
        { label: 'mongo-service is a reserved keyword Kubernetes resolves automatically', correct: false },
        { label: 'DNS names are mandatory in every Kubernetes YAML file', correct: false },
      ],
      explanation: 'A Service is a stable abstraction precisely because its DNS name never changes even as the pods behind it are replaced. Referencing a pod IP directly would break the moment that pod restarted and received a new IP, which is exactly the fragility Services are designed to remove.',
    },
  },
  {
    id: '10.6',
    title: 'Scaling & Updating Deployments',
    duration: '9 min',
    kind: 'concept',
    summary: [
      'Revisit the image-edit demo from Section 9 through today\'s lens: editing a Deployment\'s image and re-applying triggers what Kubernetes calls a <strong>rolling update</strong>. A brand-new ReplicaSet, matching the new pod template, is scaled up to the desired replica count while the old ReplicaSet is scaled down to zero, pod by pod, so the application never drops to zero running replicas during the switch. That is exactly why that earlier demo\'s <code>kubectl get replicaset</code> showed the old ReplicaSet\'s desired and current counts fall to 0 while a brand-new ReplicaSet appeared holding the full replica count.',
      'There are two ways to change how many replicas of a Deployment are running. <code>kubectl scale deployment &lt;name&gt; --replicas=&lt;n&gt;</code> is imperative — fast, and useful for a quick, temporary change, like absorbing an unexpected traffic spike. Editing <code>spec.replicas</code> in the YAML file and re-applying is the declarative equivalent, and it is generally the better default: an imperative <code>kubectl scale</code> is never reflected back into your committed YAML file, so the next time that file is applied — say, from a deployment pipeline — Kubernetes will happily scale the Deployment right back down to whatever number the file still says, silently undoing the manual change.',
      '<code>kubectl rollout status deployment/&lt;name&gt;</code> watches a rolling update until Kubernetes reports it complete, which is useful for scripting or simply confirming a change has fully landed rather than guessing from a series of <code>get</code> calls. If an update turns out to be broken, <code>kubectl rollout undo deployment/&lt;name&gt;</code> rolls the Deployment back to its previous ReplicaSet\'s pod template — Kubernetes deliberately keeps a short history of recent ReplicaSets specifically to make this kind of rollback possible without you having to remember or re-type the old configuration.',
      'Stepping back, scaling and rolling updates are not separate features bolted onto Kubernetes — they are the same reconciliation loop from earlier in this section, applied to a changed <code>spec</code>. You declare a new desired replica count or a new pod template, and Kubernetes works out, and executes, exactly which pods need to be created or terminated to get the cluster from where it is to where you told it to be.',
    ],
    keyPoints: [
      'Changing a Deployment\'s pod template (for example, its image) triggers a <strong>rolling update</strong>: a new ReplicaSet is scaled up while the old one is scaled down, pod by pod, so there is no downtime window.',
      '<code>kubectl scale deployment &lt;name&gt; --replicas=&lt;n&gt;</code> changes the replica count immediately but imperatively — it does not update your YAML file.',
      'The declarative equivalent — editing <code>spec.replicas</code> in the file and re-applying — is preferred because the file remains the accurate source of truth.',
      '<code>kubectl rollout status deployment/&lt;name&gt;</code> watches a rolling update until it finishes; <code>kubectl rollout undo deployment/&lt;name&gt;</code> reverts to the previous ReplicaSet\'s pod template.',
      'Scaling and rolling updates are both just Kubernetes\' reconciliation loop reacting to a newly declared spec — there is no separate "scaling engine" or "update engine" underneath.',
    ],
    code: `# Imperative scaling -- fast, but not reflected in your YAML file
kubectl scale deployment nginx-deployment --replicas=5
# deployment.apps/nginx-deployment scaled

kubectl get deployment nginx-deployment
# NAME               READY   UP-TO-DATE   AVAILABLE   AGE
# nginx-deployment   5/5     5            5           12m

# Declarative scaling -- edit "replicas: 5" in nginx-deployment.yaml, then:
kubectl apply -f nginx-deployment.yaml
# deployment.apps/nginx-deployment configured

# Rolling update after changing the image and re-applying
kubectl set image deployment/nginx-deployment nginx=nginx:1.17
# deployment.apps/nginx-deployment image updated

kubectl rollout status deployment/nginx-deployment
# Waiting for deployment "nginx-deployment" rollout to finish: 2 out of 5 new replicas have been updated...
# deployment "nginx-deployment" successfully rolled out

# The ReplicaSet history a rollout leaves behind
kubectl get replicaset
# NAME                    DESIRED   CURRENT   READY   AGE
# nginx-deployment-6c9    0         0         0       12m
# nginx-deployment-7d4    5         5         5       40s

# Broke something? Roll back to the previous pod template
kubectl rollout undo deployment/nginx-deployment
# deployment.apps/nginx-deployment rolled back`,
    codeLabel: 'terminal',
    note: {
      label: 'WHEN TO USE',
      text: 'Reach for kubectl scale for a quick, temporary experiment. Use the YAML file plus kubectl apply for anything that should survive the next deployment pipeline run.',
      tone: 'accent',
    },
    quiz: {
      question: 'You ran kubectl scale deployment web --replicas=10 to handle a traffic spike, but never updated web-deployment.yaml. What happens the next time your deployment pipeline runs kubectl apply -f web-deployment.yaml, which still says replicas: 3?',
      options: [
        { label: 'Kubernetes scales the Deployment back down to 3 replicas, matching the file', correct: true },
        { label: 'Nothing changes, since kubectl apply ignores replica count', correct: false },
        { label: 'Kubernetes keeps 10 replicas since that was the most recent scale command', correct: false },
        { label: 'The apply command fails with a conflict error', correct: false },
      ],
      explanation: 'apply always reconciles the cluster to match whatever the file currently declares. Since the file still says replicas: 3, and the file is the source of truth apply enforces, the manual scale-up is silently reverted the moment the pipeline reapplies it.',
    },
  },
]
