export default [
  {
    id: '13.1',
    title: 'ConfigMaps & Secrets: Environment Variables vs Volumes',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'Back in Section 8 (Kubernetes Fundamentals: Components & Architecture) you were briefly introduced to <code>ConfigMap</code> and <code>Secret</code> as two of the core Kubernetes components: a <code>ConfigMap</code> stores non-sensitive configuration as key-value pairs, and a <code>Secret</code> stores sensitive data (passwords, tokens, certificates) in the same key-value shape. In that lesson you saw them used to supply <em>individual</em> values as environment variables in a Pod spec, referencing one key at a time via <code>configMapKeyRef</code> and <code>secretKeyRef</code>. That pattern is perfect when your application needs a handful of discrete settings, like a database host name or a single API token.',
      'But a huge number of real applications do not consume configuration as scattered environment variables at all — they expect to read a complete configuration <em>file</em> from a specific path on disk. Think of Prometheus\'s <code>prometheus.yml</code>, an nginx <code>nginx.conf</code>, a Mosquitto message broker\'s <code>mosquitto.conf</code>, or an internal application with a "passwords.properties" file listing credentials for ten external services it talks to. You cannot reasonably explode a multi-line config file into dozens of individual environment variables and expect the application to reconstruct it — most applications simply were not written to work that way.',
      'This is where the second usage mode of ConfigMap and Secret comes in: instead of a key mapping to a short string, a single key can hold the <em>entire contents</em> of a file as its value. Kubernetes can then mount that key as an actual file inside the container\'s filesystem, at whatever path the application expects to find it. Mechanically this means ConfigMap and Secret are not just configuration objects — they are also two of Kubernetes\'s built-in <strong>volume types</strong>, alongside things like <code>PersistentVolumeClaim</code> which you\'ll meet later in this section. The difference is that they are entirely managed by Kubernetes itself rather than backed by an external storage system.',
      'One nuance to internalize now, before working with Secrets in practice: the values inside a Secret are <strong>base64-encoded, not encrypted</strong>. Base64 is a reversible text encoding, not a cipher — anyone with read access to the Secret object (or to the underlying etcd datastore, if it is not encrypted at rest) can trivially decode it back to plain text. Kubernetes gives Secrets a name that suggests protection, but the real protection comes from RBAC rules controlling who can read Secret objects, and from enabling encryption-at-rest for etcd — not from base64 itself.',
    ],
    keyPoints: [
      'A ConfigMap or Secret can hold either individual key-value pairs (consumed as environment variables) or an entire file\'s contents as the value of a single key (consumed as a mounted volume).',
      'Environment variables are resolved <strong>once, at container start</strong> — updating the underlying ConfigMap or Secret does not change values already injected into a running process.',
      'A Secret\'s data is <strong>base64-encoded, not encrypted</strong> — treat it as obfuscation, not protection. Real protection comes from RBAC restricting who can read Secrets, plus etcd encryption-at-rest.',
      'Use the YAML block-scalar pipe syntax (<code>|</code>) to embed a full multi-line file as the value of a ConfigMap or Secret key.',
      'Volume-mounted ConfigMaps and Secrets are how you hand a complete configuration file to an application that only knows how to read from disk — nginx.conf, prometheus.yml, mosquitto.conf, a passwords file, or a client certificate.',
    ],
    code: `# 1) RECAP from Section 8 — individual values injected as environment variables
apiVersion: v1
kind: ConfigMap
metadata:
  name: mongo-config
data:
  db_host: mongodb-service   # a single key-value pair

---
apiVersion: v1
kind: Secret
metadata:
  name: mongo-secret
type: Opaque
data:
  mongo-username: bW9uZ28tdXNlcg==   # base64("mongo-user")
  mongo-password: cGFzc3dvcmQ=       # base64("password")

---
apiVersion: v1
kind: Pod
metadata:
  name: webapp
spec:
  containers:
    - name: webapp
      image: my-webapp:1.0
      env:
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: mongo-config
              key: db_host
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: mongo-secret
              key: mongo-username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mongo-secret
              key: mongo-password

# 2) NEW in this lesson — an entire file as the value of a single key
apiVersion: v1
kind: ConfigMap
metadata:
  name: mosquitto-config-file
data:
  mosquitto.conf: |
    listener 1883
    persistence true
    persistence_location /mosquitto/data/
    log_dest stdout

---
apiVersion: v1
kind: Secret
metadata:
  name: mosquitto-secret-file
type: Opaque
data:
  # echo -n "super secret, nobody should see" | base64
  secret.file: c3VwZXIgc2VjcmV0LCBub2JvZHkgc2hvdWxkIHNlZQ==`,
    codeLabel: 'yaml',
    note: {
      label: 'WHEN TO USE',
      text: 'Use environment-variable injection for a small number of discrete values an application reads at startup. Switch to a volume mount the moment an application expects a complete configuration file on disk — you cannot fake that with environment variables alone unless you write custom bootstrap logic to reassemble one.',
      tone: 'accent',
    },
    quiz: {
      question: 'Your Node.js app has a single <code>DATABASE_URL</code> connection string it needs at startup. Mosquitto, a message broker, needs an entire <code>mosquitto.conf</code> file mounted at <code>/mosquitto/config/mosquitto.conf</code>. Which statement is correct?',
      options: [
        { label: 'Both should be handled the same way, using ConfigMap volumes', correct: false },
        { label: 'The Node.js app should use environment-variable injection from a ConfigMap; Mosquitto should use a ConfigMap volume mount', correct: true },
        { label: 'Both should be handled with environment variables since Kubernetes cannot mount files', correct: false },
        { label: 'Mosquitto\'s configuration cannot be managed by Kubernetes and must be baked into the image', correct: false },
      ],
      explanation: 'A single discrete value like a connection string is a perfect fit for environment-variable injection via configMapKeyRef. An application that expects to read a complete configuration file from a specific filesystem path needs that file mounted as a volume — Kubernetes cannot automatically turn environment variables into a file unless the application itself is written to reassemble one, which most are not.',
    },
  },
  {
    id: '13.2',
    title: 'Mounting ConfigMaps & Secrets as Volumes',
    duration: '8 min',
    kind: 'demo',
    summary: [
      'This lesson puts the volume-mounting concept from 13.1 into practice using Mosquitto, a lightweight MQTT message broker, as the example application — the same one used in the source demo. A default Mosquitto container, with no volumes attached, comes with a pre-configured internal directory structure: <code>/mosquitto/config</code>, <code>/mosquitto/data</code>, and <code>/mosquitto/log</code>. Inside <code>/mosquitto/config</code> sits a default <code>mosquitto.conf</code> file that ships with nothing but commented-out example settings — none of them actually active. The goal here is to overwrite that default file with our own configuration, and additionally mount a secret file, by using a ConfigMap and a Secret as volumes.',
      'A hard rule of Kubernetes volumes backed by cluster resources: the ConfigMap and Secret must already exist in the cluster <em>before</em> a Pod that references them is scheduled. If you apply a Deployment that references a ConfigMap named <code>mosquitto-config-file</code> before that ConfigMap exists, the Pod gets stuck in <code>ContainerCreating</code> with a mount-failure event, rather than starting successfully and picking up the file later.',
      'Mounting works in two distinct layers, and understanding both is essential once you move to multi-container pods. First, at the <strong>Pod</strong> level, <code>spec.volumes</code> lists every volume available to the Pod, along with its backing type — here, <code>configMap</code> referencing the ConfigMap\'s name, and <code>secret</code> referencing the Secret\'s <code>secretName</code>. Second, at the <strong>container</strong> level, each container declares its own <code>volumeMounts</code> list, choosing which of the Pod\'s declared volumes it actually wants mounted, and at what filesystem path. This separation matters because a Pod can run multiple containers, and you might deliberately want only one of them to have access to a particular certificate or config file — the two-layer design gives you that per-container control.',
      'Once applied, exec\'ing into the running container (<code>kubectl exec -it &lt;pod&gt; -- sh</code>) and inspecting the filesystem shows the previously commented-out <code>mosquitto.conf</code> replaced by the real configuration mounted from the ConfigMap, and a new <code>secret.file</code> readable in plain text inside the container (Kubernetes decodes the base64 automatically when mounting — the encoding only obscures the value as stored in the API/etcd, not once it lands on disk in the container). Note also that <code>mountPath</code> is application-specific: nginx expects its config under <code>/etc/nginx</code>, Elasticsearch under <code>/etc/elasticsearch</code>, and so on — you always mount to wherever the specific application looks for its files.',
    ],
    keyPoints: [
      'A ConfigMap or Secret must already exist in the cluster <strong>before</strong> a Pod referencing it is created — otherwise the Pod is stuck in <code>ContainerCreating</code> until it does.',
      'Pod-level <code>spec.volumes</code> declares available volumes and their backing type (<code>configMap</code> / <code>secret</code>); container-level <code>volumeMounts</code> decides which of those volumes actually land inside a given container, and at what path.',
      '<code>mountPath</code> must match where the target application expects its configuration file — that convention differs by application (nginx: <code>/etc/nginx</code>, Mosquitto: <code>/mosquitto/config</code>, Elasticsearch: <code>/etc/elasticsearch</code>).',
      'Add <code>readOnly: true</code> to volume mounts holding configuration or certificate files that the running application should never modify.',
      'In a multi-container Pod, you decide per-container which volumes it gets access to — a sidecar does not automatically see every volume the main container has.',
    ],
    code: `# mosquitto-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mosquitto-config-file
data:
  mosquitto.conf: |
    listener 1883
    persistence true
    persistence_location /mosquitto/data/
    log_dest stdout
    allow_anonymous false
    password_file /mosquitto/secret/secret.file

---
# mosquitto-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: mosquitto-secret-file
type: Opaque
data:
  # echo -n "super secret, nobody should see" | base64
  secret.file: c3VwZXIgc2VjcmV0LCBub2JvZHkgc2hvdWxkIHNlZQ==

---
# mosquitto-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mosquitto-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mosquitto
  template:
    metadata:
      labels:
        app: mosquitto
    spec:
      volumes:
        - name: mosquitto-config
          configMap:
            name: mosquitto-config-file
        - name: mosquitto-secret
          secret:
            secretName: mosquitto-secret-file
      containers:
        - name: mosquitto
          image: eclipse-mosquitto:2.0
          ports:
            - containerPort: 1883
          volumeMounts:
            - name: mosquitto-config
              mountPath: /mosquitto/config
              readOnly: true
            - name: mosquitto-secret
              mountPath: /mosquitto/secret
              readOnly: true

# --- Verify ---
# kubectl apply -f mosquitto-config.yaml -f mosquitto-secret.yaml -f mosquitto-deployment.yaml
# kubectl exec -it <mosquitto-pod> -- sh
# / # cat /mosquitto/config/mosquitto.conf   -> shows the new config, not the commented-out default
# / # cat /mosquitto/secret/secret.file      -> "super secret, nobody should see"`,
    codeLabel: 'yaml',
    note: {
      label: 'KEY INSIGHT',
      text: 'ConfigMap and Secret are volume types just like PersistentVolumeClaim — but they are entirely managed by Kubernetes itself rather than backed by external physical storage, which is exactly why they are easy to overlook as "real" volumes at first.',
      tone: 'accent',
    },
    quiz: {
      question: 'You create a Deployment that mounts a ConfigMap named <code>app-config</code> before creating the ConfigMap itself. What happens?',
      options: [
        { label: 'Kubernetes automatically creates an empty ConfigMap with that name', correct: false },
        { label: 'The Pod fails to start (stuck in ContainerCreating) until the ConfigMap exists', correct: true },
        { label: 'The container starts with an empty directory at the mount path and no error', correct: false },
        { label: 'Kubernetes silently skips that volume mount and starts the container anyway', correct: false },
      ],
      explanation: 'ConfigMaps and Secrets are cluster resources, and Kubernetes cannot mount a volume from a resource that does not exist. Any Pod referencing a missing ConfigMap or Secret is stuck in a ContainerCreating state with a MountVolume.SetUp failed event until the resource is created.',
    },
  },
  {
    id: '13.3',
    title: 'Persistent Volumes & Persistent Volume Claims',
    duration: '7 min',
    kind: 'concept',
    summary: [
      'Containers are ephemeral by design — when a Pod restarts, whatever it wrote to its own container filesystem is gone. That is fine for stateless applications, but it is a problem the moment you run something like a MySQL database Pod: without extra configuration, restarting that Pod wipes out every database, user, and row of data it had. To fix this you need storage that lives independently of any single Pod\'s lifecycle, that is reachable no matter which node the replacement Pod happens to be scheduled onto (since you don\'t control that), and that survives even harsher failure scenarios like a full cluster crash.',
      'A <code>PersistentVolume</code> (PV) is Kubernetes\'s abstraction for exactly this: think of it as a cluster resource, similar to CPU or RAM, that represents some actual physical storage. A PV\'s spec defines things like capacity and access mode, but it must ultimately point at a real storage backend — a local disk on a cluster node, an external NFS server, or cloud block storage like AWS EBS or Google Cloud persistent disks. Kubernetes itself does not create or manage that underlying storage; a cluster <strong>administrator</strong> is responsible for provisioning the actual storage and then creating a PV object that describes it. An important structural detail: PersistentVolumes are <strong>not namespaced</strong> — unlike Pods and Services, they exist cluster-wide, available to any namespace.',
      'The developer-facing half of this is the <code>PersistentVolumeClaim</code> (PVC) — a request for storage, expressed as "give me 10Gi with ReadWriteOnce access," created in the same namespace as the application that needs it. Kubernetes binds a PVC to any PV whose capacity and access mode satisfy the request. Crucially, a Pod never references a PV directly — it references the PVC by name in its <code>volumes</code> list, and the PVC-to-PV binding happens behind the scenes. This two-layer design deliberately separates concerns: the cluster administrator manages what storage physically exists, while the developer only has to declare what storage their application needs, with zero knowledge of whether it is backed by NFS, a cloud disk, or a local drive.',
      'Access modes constrain how many nodes can mount a volume, and in which mode: <code>ReadWriteOnce</code> allows read-write from a single node at a time (the most common for databases), <code>ReadOnlyMany</code> allows many nodes to mount read-only, and <code>ReadWriteMany</code> allows many nodes to mount read-write simultaneously (only supported by some backends, like NFS). A Pod can also combine multiple volume types at once — for example, a PVC for its data directory, a ConfigMap for its configuration file, and a Secret for a client certificate, all mounted side by side.',
    ],
    keyPoints: [
      'A PersistentVolume represents actual provisioned storage (local disk, NFS, or cloud block storage) as a cluster resource, similar to how CPU and RAM are cluster resources.',
      'PersistentVolumes are <strong>not namespaced</strong> — they are available to the whole cluster; PersistentVolumeClaims are namespaced and must live in the same namespace as the Pod using them.',
      'A PVC is a request for storage (size + access mode) that Kubernetes binds to a matching PV — a Pod only ever references the PVC, never the PV directly.',
      'This two-layer model separates the <strong>administrator\'s</strong> job (provision real storage, create PVs) from the <strong>developer\'s</strong> job (claim storage via PVC) — the developer does not need to know what is backing the storage.',
      'Access modes like <code>ReadWriteOnce</code> (single node, read-write), <code>ReadOnlyMany</code>, and <code>ReadWriteMany</code> constrain how many nodes can mount a volume simultaneously — most cloud block storage only supports ReadWriteOnce.',
    ],
    code: `# persistent-volume.yaml — created by the cluster administrator
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mongo-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  nfs:
    server: 10.0.1.50
    path: /exports/mongo-data

---
# persistent-volume-claim.yaml — created by the developer, in the app's namespace
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongo-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi

---
# pod.yaml — the Pod only ever references the claim, never the PV directly
apiVersion: v1
kind: Pod
metadata:
  name: mongo
spec:
  containers:
    - name: mongo
      image: mongo:6.0
      volumeMounts:
        - name: mongo-storage
          mountPath: /data/db
  volumes:
    - name: mongo-storage
      persistentVolumeClaim:
        claimName: mongo-pvc`,
    codeLabel: 'yaml',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'The PV/PVC split means a developer can request "10Gi of ReadWriteOnce storage" without ever learning whether it is backed by an NFS server, an AWS EBS volume, or a local SSD — that decision belongs entirely to whoever administers the cluster.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why are PersistentVolumeClaims namespaced while PersistentVolumes are not?',
      options: [
        { label: 'It is an arbitrary Kubernetes API design choice with no real reasoning', correct: false },
        { label: 'PVs represent cluster-wide infrastructure resources managed by administrators, while PVCs represent a specific application\'s request for storage and must live alongside that application in its namespace', correct: true },
        { label: 'PVCs are namespaced only when using cloud storage backends', correct: false },
        { label: 'PVs cannot be namespaced because they use a different API version than PVCs', correct: false },
      ],
      explanation: 'PersistentVolumes are analogous to cluster-wide resources like Nodes — they exist independent of any particular team or application. PersistentVolumeClaims belong to a specific workload, so they live in that workload\'s namespace, just like the Pods that use them.',
    },
  },
  {
    id: '13.4',
    title: 'StorageClasses & Dynamic Provisioning',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'The PV/PVC model from the previous lesson works well, but it has a scaling problem: in a cluster with hundreds of applications being deployed continuously, having a human administrator manually provision physical storage and hand-create a matching PV for every single PVC request does not scale. It is slow, manual, and completely at odds with the kind of automated, self-service deployment pipelines teams rely on today.',
      'A <code>StorageClass</code> solves this by defining a <code>provisioner</code> — a plugin that knows how to dynamically create both the underlying physical storage <em>and</em> a matching PV, automatically, the moment a PVC asks for it. Internal Kubernetes provisioners are prefixed <code>kubernetes.io/...</code> (for example, <code>kubernetes.io/aws-ebs</code>); many storage systems also ship their own external provisioners that plug into the same mechanism. With a StorageClass in place, the administrator\'s job shifts from "create a PV for every app" to "create a StorageClass once per storage tier or backend" — a massive reduction in manual work.',
      'From the developer\'s side, opting into dynamic provisioning is simple: a PVC sets <code>storageClassName</code> to the name of a StorageClass instead of relying on a pre-existing PV. No PV needs to exist beforehand — the StorageClass\'s provisioner creates one on demand, sized and configured to satisfy that specific claim. A StorageClass\'s <code>parameters</code> section configures backend-specific characteristics, like disk type (SSD vs. HDD), IOPS, or filesystem type, letting an administrator offer multiple named storage tiers (e.g. <code>fast-ssd</code> vs. <code>standard-hdd</code>) that developers simply pick by name.',
      'Static provisioning (an admin hand-creating a specific PV) still has a legitimate place — most commonly when you need to bind to a specific pre-existing storage resource that already contains data, such as an NFS export inherited from a legacy system. But in any modern, cloud-backed cluster, dynamic provisioning via a StorageClass is the default approach, and most managed Kubernetes offerings (EKS, GKE, AKS) ship with a default StorageClass already configured.',
    ],
    keyPoints: [
      'A <code>StorageClass</code> defines a <code>provisioner</code> that automatically creates a PersistentVolume (and the backing physical storage) on demand, whenever a matching PVC is created.',
      'Internal Kubernetes provisioners are prefixed <code>kubernetes.io/...</code> (e.g. <code>kubernetes.io/aws-ebs</code>); other storage systems ship their own external provisioners.',
      'A PVC opts into dynamic provisioning by setting <code>storageClassName</code> to the name of a StorageClass — no PV needs to exist beforehand.',
      '<code>parameters</code> in a StorageClass configure backend-specific characteristics like disk type, IOPS, or filesystem type, letting an admin offer multiple named storage tiers.',
      'Static provisioning (an admin hand-creates each PV) still has a place — e.g. reusing a specific pre-existing NFS export — but dynamic provisioning is the default in cloud-native, self-service clusters.',
    ],
    code: `# storage-class.yaml — created once per storage tier by the administrator
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  fsType: ext4
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer

---
# pvc-dynamic.yaml — developer requests storage; no pre-existing PV required
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongo-pvc-dynamic
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 20Gi`,
    codeLabel: 'yaml',
    note: {
      label: 'DECISION POINT',
      text: 'Use dynamic provisioning (a StorageClass) by default in any cloud-backed cluster — it removes the administrator from the deploy loop entirely. Fall back to a manually created static PV only when you must bind to a specific pre-existing storage resource, like an NFS export that already contains data.',
      tone: 'accent',
    },
    quiz: {
      question: 'A PVC sets <code>storageClassName: fast-ssd</code>, but no StorageClass named <code>fast-ssd</code> exists in the cluster. What happens?',
      options: [
        { label: 'Kubernetes automatically creates a StorageClass with default settings', correct: false },
        { label: 'The PVC remains unbound and Pending indefinitely since there is no matching StorageClass to provision from', correct: true },
        { label: 'The PVC falls back silently to static provisioning against any available PV', correct: false },
        { label: 'The cluster throws a fatal error and the API server stops accepting requests', correct: false },
      ],
      explanation: 'A PVC that names a nonexistent StorageClass has nothing to provision from — there is no provisioner available to create a PV for it. It stays in a Pending state until either a matching StorageClass is created or an administrator manually creates a compatible static PV.',
    },
  },
  {
    id: '13.5',
    title: 'StatefulSet vs Deployment: When State Matters',
    duration: '7 min',
    kind: 'concept',
    summary: [
      'A stateless application — a typical Node.js or Java REST API — handles every request independently, using only the information in that request\'s payload. Scaling it means running several identical, interchangeable, disposable replicas via a <code>Deployment</code>: pods get random hash suffixes appended to their name, a Service load-balances requests to any one of them round-robin, and they can be created or deleted in any order, at any time, without consequence.',
      'A stateful application, like a MySQL database, cannot scale that way. If you allow two independent MySQL instances to both accept writes against what is supposed to be "the same" data, you get data inconsistency almost immediately. So a clustered database designates exactly one replica as the <strong>primary</strong> (the only one allowed to accept writes) while the rest are <strong>replicas</strong> that continuously synchronize from it and serve reads. Each replica also needs its <em>own</em> separate physical storage — they are not sharing one disk — and when a brand-new replica joins, it first has to clone existing data from the set before it can start participating in synchronization.',
      '<code>StatefulSet</code> is the Kubernetes component purpose-built for this. Unlike Deployment, it gives every Pod a persistent, sticky identity instead of a disposable random one: fixed, ordered names like <code>mysql-0</code>, <code>mysql-1</code>, <code>mysql-2</code>; Pods are created strictly in order (Pod N+1 is only created once Pod N is Running and Ready) and deleted in strict reverse order; each Pod additionally gets a stable, individual DNS name via a <strong>headless Service</strong> (a Service with <code>clusterIP: None</code>), on top of its normal but disposable Pod IP; and through <code>volumeClaimTemplates</code>, each Pod gets its own dedicated PVC that reattaches to that same ordinal Pod even after it is deleted and recreated. Remote (not node-local) storage is required here, because a rescheduled Pod may land on an entirely different node and still needs to reach the exact same volume it had before.',
      'The rule of thumb: use <code>Deployment</code> whenever replicas are truly interchangeable and disposable. Use <code>StatefulSet</code> whenever replicas are <em>not</em> interchangeable — they each carry their own identity, have ordering requirements for startup or shutdown, or need their own stable, individually addressable persistent storage.',
    ],
    keyPoints: [
      'Stateless apps (deployed via <code>Deployment</code>) treat every replica as interchangeable — random pod-name suffixes, any-order creation/deletion, round-robin load balancing.',
      'Stateful apps (e.g. databases) need a primary that accepts writes plus replicas that continuously sync from it — replicas are <em>not</em> interchangeable, so each needs its own identity.',
      '<code>StatefulSet</code> gives each pod a fixed, ordered name (<code>mysql-0</code>, <code>mysql-1</code>, …), starts/stops pods strictly in order, and gives each one a stable DNS name via a <strong>headless Service</strong>.',
      '<code>volumeClaimTemplates</code> in a StatefulSet spec provision a dedicated PVC per replica, which reattaches to the same ordinal pod (e.g. <code>mysql-1</code>) even after it is rescheduled.',
      'Remote storage (not node-local) is required for StatefulSets, since a rescheduled pod may land on a different node and must still reach its original volume.',
    ],
    code: `# headless-service.yaml — gives each StatefulSet pod its own stable DNS name
apiVersion: v1
kind: Service
metadata:
  name: mysql
spec:
  clusterIP: None    # "None" makes this a headless Service
  selector:
    app: mysql
  ports:
    - port: 3306

---
# statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql        # must match the headless Service above
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          ports:
            - containerPort: 3306
          volumeMounts:
            - name: mysql-data
              mountPath: /var/lib/mysql
  volumeClaimTemplates:
    - metadata:
        name: mysql-data
      spec:
        accessModes: [ "ReadWriteOnce" ]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 10Gi

# Resulting pods: mysql-0, mysql-1, mysql-2
# Resulting per-pod DNS: mysql-0.mysql.default.svc.cluster.local, etc.
# Resulting PVCs: mysql-data-mysql-0, mysql-data-mysql-1, mysql-data-mysql-2`,
    codeLabel: 'yaml',
    note: {
      label: 'KEY INSIGHT',
      text: 'A StatefulSet\'s ordered, sticky pod names combined with per-pod PVCs are what let a restarted mysql-1 come back as the exact same replica, with the exact same data and role, instead of an interchangeable random clone.',
      tone: 'accent',
    },
    quiz: {
      question: 'You scale a StatefulSet named "mysql" with 3 replicas down to 1. Which pod(s) get deleted, and in what order?',
      options: [
        { label: 'A random pod is chosen and deleted immediately', correct: false },
        { label: 'mysql-2 is deleted first, then mysql-1 — mysql-0 remains, always in that strict reverse order', correct: true },
        { label: 'All three pods are deleted simultaneously and one new pod, mysql-0, is created from scratch', correct: false },
        { label: 'mysql-0 is deleted first since it was created first', correct: false },
      ],
      explanation: 'StatefulSets scale down in strict reverse ordinal order — the highest-numbered pod goes first, and each deletion waits for the previous one to complete before proceeding. This protects the primary (typically mysql-0) and preserves replication integrity during scale-down.',
    },
  },
  {
    id: '13.6',
    title: 'Running a Stateful Application',
    duration: '9 min',
    kind: 'demo',
    summary: [
      'This lesson brings together everything from the section into one working example: a MongoDB replica set deployed with a ConfigMap holding <code>mongod.conf</code> (from 13.1/13.2), a headless Service and StatefulSet with <code>volumeClaimTemplates</code> (from 13.5), requesting storage dynamically from a <code>StorageClass</code> (from 13.4), which is ultimately backed by a PersistentVolume Kubernetes provisions for it (from 13.3). Every concept from this section shows up together in one manifest set.',
      'Applying the manifests and watching <code>kubectl get pods -w</code> shows the ordered creation guaranteed by StatefulSet: <code>mongo-0</code> reaches Running and Ready first, only then does <code>mongo-1</code> start, then <code>mongo-2</code>. Running <code>kubectl get pvc</code> afterward shows three separate claims, automatically named <code>mongo-data-mongo-0</code>, <code>mongo-data-mongo-1</code>, and <code>mongo-data-mongo-2</code> — one dedicated claim per replica, exactly as <code>volumeClaimTemplates</code> promises.',
      'To prove persistence actually works, write a document into <code>mongo-0</code> via <code>mongosh</code>, then delete that specific pod with <code>kubectl delete pod mongo-0</code>. Kubernetes recreates it — with the identical name <code>mongo-0</code> — and reattaches the exact same PVC it had before, rather than provisioning a fresh, empty one. Querying for the previously inserted document afterward confirms it is still there: the pod\'s ephemeral container filesystem was replaced, but its persistent storage was not.',
      'One distinction worth internalizing here: the ConfigMap-backed <code>mongod.conf</code> mount is <em>identical and shared</em> across every replica — all three pods read the same configuration file — while the <code>volumeClaimTemplates</code>-backed data directory is <em>unique per replica</em>, each with its own separate storage and separate data. Both are "volumes" in the pod spec, but they serve fundamentally different purposes, and confusing the two is a common source of "why does replica 2 have replica 0\'s data" debugging sessions (it should not, and will not, when configured correctly).',
    ],
    keyPoints: [
      'Combine a ConfigMap-backed config file, a headless Service, and a StatefulSet with <code>volumeClaimTemplates</code> to run a stateful application with both shared configuration and per-replica private storage.',
      'Deleting a StatefulSet pod does not delete its PVC — the replacement pod, created with the same ordinal name, reattaches to the exact same storage and its data survives.',
      '<code>kubectl get pvc</code> after applying a StatefulSet shows one auto-named claim per replica (<code>&lt;volumeClaimTemplate-name&gt;-&lt;pod-name&gt;</code>), each bound to its own PersistentVolume.',
      'A ConfigMap volume mount is shared identically across every replica; a <code>volumeClaimTemplates</code> volume is unique per replica — do not confuse the two when reasoning about what data or config a specific replica actually has.',
      'Deleting a StatefulSet itself (<code>kubectl delete statefulset mongo</code>) leaves its PVCs — and their data — behind by default; you must delete PVCs explicitly to fully reclaim the underlying storage.',
    ],
    code: `# mongo-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mongo-config
data:
  mongod.conf: |
    net:
      port: 27017
    storage:
      dbPath: /data/db
    replication:
      replSetName: rs0

---
# mongo-headless-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: mongo
spec:
  clusterIP: None
  selector:
    app: mongo
  ports:
    - port: 27017

---
# mongo-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongo
spec:
  serviceName: mongo
  replicas: 3
  selector:
    matchLabels:
      app: mongo
  template:
    metadata:
      labels:
        app: mongo
    spec:
      containers:
        - name: mongo
          image: mongo:6.0
          command: ["mongod", "--config", "/etc/mongo/mongod.conf"]
          ports:
            - containerPort: 27017
          volumeMounts:
            - name: mongo-config
              mountPath: /etc/mongo
              readOnly: true
            - name: mongo-data
              mountPath: /data/db
      volumes:
        - name: mongo-config
          configMap:
            name: mongo-config
  volumeClaimTemplates:
    - metadata:
        name: mongo-data
      spec:
        accessModes: [ "ReadWriteOnce" ]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 10Gi

# --- Verify persistence ---
# kubectl apply -f mongo-config.yaml -f mongo-headless-service.yaml -f mongo-statefulset.yaml
# kubectl get pods -w
#   mongo-0   Running   (created first)
#   mongo-1   Running   (created only after mongo-0 is Ready)
#   mongo-2   Running   (created only after mongo-1 is Ready)
#
# kubectl get pvc
#   mongo-data-mongo-0   Bound   10Gi
#   mongo-data-mongo-1   Bound   10Gi
#   mongo-data-mongo-2   Bound   10Gi
#
# kubectl exec -it mongo-0 -- mongosh --eval "db.test.insertOne({hello: 'world'})"
# kubectl delete pod mongo-0
# kubectl get pods -w        # mongo-0 recreated with the SAME name
# kubectl exec -it mongo-0 -- mongosh --eval "db.test.find()"   # data is still there`,
    codeLabel: 'yaml',
    note: {
      label: 'WARNING',
      text: 'Deleting a StatefulSet does not delete its PersistentVolumeClaims or the underlying data by default — this protects you from an accidental typo wiping your database, but it also means old storage keeps costing money until you explicitly run kubectl delete pvc.',
      tone: 'accent',
    },
    quiz: {
      question: 'After <code>kubectl delete pod mongo-0</code> completes and Kubernetes recreates the pod, what happens to the data that was previously written to it?',
      options: [
        { label: 'It is lost, because pod deletion always wipes the container\'s data', correct: false },
        { label: 'It is preserved — the StatefulSet recreates mongo-0 with the same name and reattaches the same PVC/PersistentVolume that already held that data', correct: true },
        { label: 'It is copied automatically from mongo-1 to repopulate mongo-0', correct: false },
        { label: 'It is preserved only if you manually run kubectl cp to restore a backup first', correct: false },
      ],
      explanation: 'Because mongo-0\'s storage comes from a PVC created by volumeClaimTemplates and tied to that specific ordinal pod name, Kubernetes reattaches the exact same PVC (and its backing PersistentVolume) to the replacement mongo-0. Pod deletion only removes the running container\'s ephemeral filesystem — the PVC and its data follow a separate lifecycle.',
    },
  },
]
