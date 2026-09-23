export default [
  {
    id: '14.1',
    title: 'Pulling Images from a Private Registry (imagePullSecrets)',
    duration: '6 min',
    kind: 'demo',
    summary: [
      'When a Docker image lives in a private registry — a private Docker Hub repository, AWS ECR, Google Container Registry, Azure ACR, or a self-hosted registry like Harbor — it is not your laptop that pulls the image when a Pod gets scheduled. It is the <strong>kubelet</strong>, the agent running on whichever worker node the scheduler picked, that reaches out to the registry and pulls the image directly. Running <code>docker login</code> on your own machine only writes credentials into your local <code>~/.docker/config.json</code> — that file never leaves your laptop, and no cluster node ever sees it. Without its own credentials, a node\'s kubelet gets an authentication failure trying to pull the private image, which surfaces on the Pod as <code>ErrImagePull</code> or <code>ImagePullBackOff</code>.',
      'The fix is to package the same kind of credentials <code>docker login</code> would use into a Kubernetes <strong>Secret</strong> that lives in the cluster, where kubelet can read it. Kubernetes has a purpose-built Secret type for exactly this, <code>kubernetes.io/dockerconfigjson</code>, created with a single command: <code>kubectl create secret docker-registry</code>, supplying the registry\'s URL, a username, a password or access token, and an email address. This Secret is namespaced, so it must exist in the same namespace as any Pod that needs to reference it.',
      'With the Secret created, a Pod (or the Pod template inside a Deployment, StatefulSet, etc.) opts into using it via the <code>spec.imagePullSecrets</code> field, listing the Secret by name. Whichever node the scheduler places that Pod on, its kubelet reads the referenced Secret and uses those credentials to authenticate to the registry before attempting the pull. If every workload in a namespace needs the same private registry — a very common setup — you can avoid repeating <code>imagePullSecrets</code> on every single manifest by instead patching the namespace\'s default <code>ServiceAccount</code> to include it; every Pod that uses that ServiceAccount (which is every Pod, unless one is explicitly assigned a different one) then inherits the pull secret automatically.',
      'Managed cloud registries often offer an alternative that avoids managing a long-lived Secret altogether — for example, AWS lets you grant a Kubernetes ServiceAccount an IAM role that has ECR pull permissions, with credentials rotated automatically behind the scenes. But the <code>docker-registry</code> Secret plus <code>imagePullSecrets</code> mechanism shown here is universal: it works identically against any private registry, on any Kubernetes distribution, anywhere.',
    ],
    keyPoints: [
      '<code>docker login</code> only authorizes your local machine — cluster nodes never see your local Docker credentials, so private image pulls fail from the cluster even if they work fine on your laptop.',
      'Create a <code>kubernetes.io/dockerconfigjson</code> Secret with <code>kubectl create secret docker-registry &lt;name&gt; --docker-server=... --docker-username=... --docker-password=... --docker-email=...</code>.',
      'Reference the Secret in the Pod/Deployment spec via <code>spec.imagePullSecrets</code> — this is what the kubelet on each node uses to authenticate before pulling the image.',
      'To avoid repeating <code>imagePullSecrets</code> on every workload, patch the namespace\'s default <code>ServiceAccount</code> to include it, and every pod using that ServiceAccount inherits it automatically.',
      'The Secret must exist in the <strong>same namespace</strong> as the Pod referencing it — like other namespaced resources, it does not automatically apply cluster-wide.',
    ],
    code: `# Create a Secret holding private registry credentials
kubectl create secret docker-registry regcred \\
  --docker-server=https://index.docker.io/v1/ \\
  --docker-username=my-dockerhub-user \\
  --docker-password=my-dockerhub-token \\
  --docker-email=me@example.com

# Verify it was created (type kubernetes.io/dockerconfigjson)
kubectl get secret regcred --output=yaml

---
# deployment.yaml — reference the secret so kubelet can pull the private image
apiVersion: apps/v1
kind: Deployment
metadata:
  name: private-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: private-app
  template:
    metadata:
      labels:
        app: private-app
    spec:
      imagePullSecrets:
        - name: regcred
      containers:
        - name: private-app
          image: mydockerhubuser/private-app:1.0
          ports:
            - containerPort: 8080

---
# Optional: attach the secret to the default ServiceAccount so every pod
# in this namespace uses it automatically, without listing it per-manifest.
apiVersion: v1
kind: ServiceAccount
metadata:
  name: default
imagePullSecrets:
  - name: regcred`,
    codeLabel: 'terminal + yaml',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'A private image that pulls fine when you test with docker run locally will still fail inside the cluster with ImagePullBackOff until the node\'s kubelet has its own credentials — this is one of the most common "works on my machine" surprises the first time you deploy a private image to Kubernetes.',
      tone: 'accent',
    },
    quiz: {
      question: 'You successfully ran <code>docker login</code> and <code>docker pull myregistry.io/app:1.0</code> on your laptop. You then deploy a Pod referencing that same image to your Kubernetes cluster, and it fails with <code>ImagePullBackOff</code>. Why?',
      options: [
        { label: 'The image tag 1.0 is invalid syntax for Kubernetes', correct: false },
        { label: 'Your local docker login only stored credentials on your machine — the node\'s kubelet has no credentials of its own unless you create an imagePullSecrets Secret and reference it in the Pod spec', correct: true },
        { label: 'Kubernetes does not support pulling images from private registries at all', correct: false },
        { label: 'ImagePullBackOff means the image was pulled successfully but failed to start', correct: false },
      ],
      explanation: 'Credentials from docker login live only in your local Docker config file. The kubelet on the node scheduling your pod is a completely separate process on a completely separate machine — it needs its own credentials, supplied via a docker-registry Secret referenced in imagePullSecrets, to authenticate to the private registry.',
    },
  },
  {
    id: '14.2',
    title: 'What Is a Kubernetes Operator? The Operator Pattern',
    duration: '6 min',
    kind: 'theory',
    summary: [
      'Kubernetes\'s built-in control loop constantly reconciles the actual state of the cluster toward the desired state you declare in YAML. This is why a stateless Deployment mostly runs itself: if a replica dies, the control loop notices and recreates it; scaling up or rolling out a new image version is just a configuration change, and Kubernetes handles all of the mechanics automatically, with zero application-specific knowledge required.',
      'That automation breaks down for stateful applications, for exactly the reasons covered in the previous lesson\'s StatefulSet vs Deployment comparison: safely running a cluster of database replicas requires knowing how to clone data into a new replica, how to promote a replacement primary if the current one dies, how to apply schema upgrades without downtime, how to take consistent backups — and all of that operational knowledge is different for every single application. MySQL\'s process looks nothing like Elasticsearch\'s, which looks nothing like Prometheus\'s. Traditionally, this expertise lives in a human being — a DBA or SRE — who performs these tasks manually. That is a direct conflict with Kubernetes\'s core premise of minimizing manual intervention through automation.',
      'A Kubernetes <strong>Operator</strong> is that human operational expertise, encoded into software that runs inside the cluster. It runs its own control loop, exactly like the built-in Deployment and StatefulSet controllers, but layered with application-specific logic: "how do I safely add a MySQL replica," "how do I fail over when the primary dies," "how do I take a Postgres backup on this schedule." Operators are built on top of <strong>Custom Resource Definitions (CRDs)</strong> — a mechanism that lets you extend the Kubernetes API with entirely new object kinds of your own, alongside the built-in ones like Deployment, ConfigMap, and StatefulSet. An Operator watches for instances of its custom kind (for example, a <code>Prometheus</code> object) the same way the built-in Deployment controller watches for Deployment objects, and reconciles the real cluster state to match.',
      'Because this operational expertise is packaged once and reused everywhere, a community- or vendor-built Operator can be deployed identically across every cluster a team runs, instead of every team separately reinventing the same manual runbooks. <strong>OperatorHub.io</strong> is a public catalog of existing Operators for common systems (Prometheus, Elasticsearch, PostgreSQL, and many more); the <strong>Operator SDK</strong> exists for teams that need to build a custom Operator when nothing pre-built fits their application.',
    ],
    keyPoints: [
      'Kubernetes automates the full lifecycle of <strong>stateless</strong> apps out of the box because it needs no application-specific knowledge to restart, scale, or update them.',
      '<strong>Stateful</strong> apps need domain-specific operational knowledge (replication, failover, backups) that differs per application — traditionally supplied by a human operator or DBA.',
      'An <strong>Operator</strong> encodes that human operational knowledge into software: it runs its own control loop, watching for and reconciling the state of a specific application.',
      'Operators are built on <strong>Custom Resource Definitions (CRDs)</strong>, which extend the Kubernetes API with new object kinds (e.g. <code>PrometheusRule</code>, a custom <code>MySQLCluster</code>) alongside built-ins like Deployment.',
      '<strong>OperatorHub.io</strong> hosts community- and vendor-built Operators you can reuse; the <strong>Operator SDK</strong> lets you build a custom one when no existing Operator fits your application.',
    ],
    code: `# A CRD extends the Kubernetes API with a brand-new object kind.
# This is a simplified sketch of the kind of CRD the Prometheus Operator installs.
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: prometheuses.monitoring.coreos.com
spec:
  group: monitoring.coreos.com
  names:
    kind: Prometheus
    plural: prometheuses
  scope: Namespaced
  versions:
    - name: v1
      served: true
      storage: true

---
# Once the CRD exists, you can create objects of this new custom kind.
# The Prometheus Operator watches for these and does all the underlying
# work of creating and configuring the actual StatefulSet, Secrets, etc.
apiVersion: monitoring.coreos.com/v1
kind: Prometheus
metadata:
  name: my-prometheus
spec:
  replicas: 2
  serviceAccountName: prometheus
  serviceMonitorSelector: {}`,
    codeLabel: 'yaml',
    note: {
      label: 'WHEN TO USE',
      text: 'Reach for an existing Operator (via OperatorHub) whenever you are running a well-known stateful system — Prometheus, Elasticsearch, PostgreSQL, Kafka — in Kubernetes. Only consider building a custom Operator with the Operator SDK when you have genuinely bespoke operational logic that no existing project already automates.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why doesn\'t Kubernetes automate the full lifecycle of a stateful application like MySQL the same way it does for a stateless Deployment?',
      options: [
        { label: 'Kubernetes deliberately refuses to support databases for licensing reasons', correct: false },
        { label: 'MySQL images are too large for the scheduler to place automatically', correct: false },
        { label: 'Kubernetes has no built-in knowledge of MySQL-specific operational tasks like replica cloning, primary failover, or backups — that knowledge is application-specific and must be supplied separately, e.g. by an Operator', correct: true },
        { label: 'StatefulSets are deprecated in favor of Operators for all stateful workloads', correct: false },
      ],
      explanation: 'Kubernetes\'s built-in controllers (Deployment, StatefulSet) know how to manage generic pod lifecycle mechanics, but they have no idea how to, say, safely promote a MySQL replica to primary. That domain-specific operational knowledge is exactly what an Operator packages and automates.',
    },
  },
  {
    id: '14.3',
    title: 'Why Helm? The Package Manager for Kubernetes',
    duration: '7 min',
    kind: 'theory',
    summary: [
      'Helm is to Kubernetes what <code>apt</code> or <code>yum</code> is to Linux, or Homebrew is to macOS: a way to find, install, and manage collections of software instead of hand-assembling every dependency yourself. Its two core features — package management and templating — solve two very different, equally common pain points.',
      'As a package manager, consider deploying the Elastic stack into a cluster by hand: you would need a <code>StatefulSet</code> for Elasticsearch itself, a <code>ConfigMap</code> for its configuration, a <code>Secret</code> for credentials, a dedicated Kubernetes user with the right permissions, and several <code>Service</code> objects to tie it together. Writing and testing all of that YAML from scratch — for an extremely common deployment pattern that thousands of other teams have already solved — is wasted, error-prone effort. A <strong>Helm chart</strong> is exactly that bundle of YAML files, packaged once (often by the application\'s own maintainers) and made reusable via a single <code>helm install &lt;chart&gt;</code> command, published either on a public registry like Artifact Hub or in a private, organization-internal chart repository.',
      'As a templating engine, Helm solves the opposite problem: near-duplicate YAML files across microservices or environments that differ only in a name, an image tag, or a replica count. Instead of maintaining ten almost-identical deployment files, you write one parameterized template using <code>{{ .Values.xyz }}</code> placeholders, plus a <code>values.yaml</code> file supplying the actual values. The final <code>.Values</code> object Helm hands to your templates is built by merging, in order of increasing precedence: the chart\'s own default <code>values.yaml</code>, an optional override file passed with <code>--values</code>, and individual <code>--set key=value</code> flags on the command line. This is exactly what makes the same chart redeployable, completely unmodified, across dev, staging, and production — only the values change.',
      'Understanding Helm\'s version history also matters, because a lot of documentation still references it: Helm 2 required a server-side component called <strong>Tiller</strong>, running inside the cluster with broad create/update/delete permissions, to track a release\'s history and enable <code>helm upgrade</code> and <code>helm rollback</code>. That gave Tiller enough power that compromising it meant compromising broad access across the entire cluster — a serious, well-documented security weakness. Helm 3 removed Tiller entirely: it is now a single client-side binary that talks directly to the Kubernetes API using your own kubeconfig and RBAC permissions, closing that security gap.',
    ],
    keyPoints: [
      'Helm is a <strong>package manager</strong> for Kubernetes — a Helm chart is a reusable, versioned bundle of the YAML manifests a complex deployment (e.g. Elasticsearch, Prometheus) needs.',
      'Helm is also a <strong>templating engine</strong>: one parameterized template file plus a <code>values.yaml</code> replaces many near-duplicate YAML files that differ only in a handful of values.',
      'Values are resolved by merging, in order (highest wins last): chart defaults (<code>values.yaml</code>) → an optional override file passed with <code>--values</code> → individual <code>--set key=value</code> flags on the command line.',
      '<strong>Helm 2</strong> required a cluster-side component called <strong>Tiller</strong> with broad permissions to manage release history — a well-known security weakness.',
      '<strong>Helm 3</strong> removed Tiller entirely; it is a single client binary that uses your own kubeconfig/RBAC permissions to talk to the API server directly.',
    ],
    code: `# templates/deployment.yaml — one template, reused across environments
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-{{ .Values.appName }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Values.appName }}
  template:
    metadata:
      labels:
        app: {{ .Values.appName }}
    spec:
      containers:
        - name: {{ .Values.appName }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - containerPort: {{ .Values.containerPort }}

---
# values.yaml — default values shipped with the chart
appName: my-service
replicaCount: 2
containerPort: 8080
image:
  repository: mydockerhubuser/my-service
  tag: "1.0"

# --- Override defaults with your own file, or individual flags ---
# helm install my-release ./my-service --values my-values.yaml
# helm install my-release ./my-service --set replicaCount=5,image.tag=2.0`,
    codeLabel: 'yaml + terminal',
    note: {
      label: 'WARNING',
      text: 'Helm 2\'s Tiller component ran inside the cluster with broad, often near-admin-level permissions to create, update, and delete resources on your behalf — a single compromised Tiller was a path to compromising the entire cluster. This was one of the main drivers behind removing it in Helm 3; if you ever see legacy documentation mentioning Tiller, know that modern Helm (3+) does not use it.',
      tone: 'accent',
    },
    quiz: {
      question: 'What was the main security concern that led to Tiller being removed in Helm 3?',
      options: [
        { label: 'Tiller was too slow at installing charts', correct: false },
        { label: 'Tiller ran as a highly privileged, cluster-side component, so compromising it could grant broad create/update/delete access across the cluster', correct: true },
        { label: 'Tiller only worked with public chart repositories, not private ones', correct: false },
        { label: 'Tiller charged a licensing fee that Helm 3 eliminated', correct: false },
      ],
      explanation: 'Tiller\'s design required it to run inside the cluster with enough permissions to create, update, and delete almost any resource, in order to track release history and perform upgrades and rollbacks. That made it an attractive, high-value target — Helm 3 solved this by removing the server-side component entirely, so operations happen directly through your own RBAC-scoped credentials.',
    },
  },
  {
    id: '14.4',
    title: 'Anatomy of a Helm Chart',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'A Helm chart follows a standard directory layout, the same one <code>helm create</code> scaffolds for you. At the top level, <code>Chart.yaml</code> holds the chart\'s metadata: its name, its own chart version, the <code>appVersion</code> of the application it deploys, a description, and a list of any chart dependencies. Right alongside it, <code>values.yaml</code> holds the chart\'s default configuration — every value referenced in the templates should have a sensible default defined here, so the chart works with zero overrides.',
      'The <code>templates/</code> directory holds the actual Kubernetes manifests, written as ordinary YAML but with <code>{{ .Values.xyz }}</code>-style placeholders substituted at install time using Go\'s templating syntax. Beyond <code>.Values</code>, templates can reference other built-in objects — <code>.Release.Name</code> (the release name given at install time) is commonly used to namespace resource names so multiple releases of the same chart don\'t collide, and <code>.Chart.Version</code> is available for labeling. An optional <code>NOTES.txt</code> file in <code>templates/</code> gets rendered and printed to the user right after a successful install — useful for showing next steps like how to retrieve a generated password.',
      'The <code>charts/</code> directory holds vendored dependency charts — for example, the Prometheus Operator\'s chart in the next two lessons pulls in the <code>kube-state-metrics</code> chart as a dependency. Dependencies are declared under <code>dependencies</code> in <code>Chart.yaml</code> and fetched into <code>charts/</code> with <code>helm dependency update</code>, so a single <code>helm install</code> on the parent chart brings in its entire dependency tree automatically.',
      'To make the value-resolution precedence concrete: if a chart\'s <code>values.yaml</code> sets <code>image.tag: "1.0"</code>, a user creates <code>my-values.yaml</code> overriding it to <code>"2.0"</code>, and also passes <code>--set replicaCount=5</code> on the command line, the final resolved configuration uses <code>image.tag: "2.0"</code> (the values file beat the chart default) and <code>replicaCount: 5</code> (the <code>--set</code> flag beat everything else). Understanding this merge order is essential once you start layering environment-specific overrides on top of chart defaults.',
    ],
    keyPoints: [
      'A Helm chart\'s top-level directory always contains <code>Chart.yaml</code> (chart metadata) and <code>values.yaml</code> (default configuration).',
      'The <code>templates/</code> directory holds the actual Kubernetes manifest templates, written in standard YAML with <code>{{ .Values.xyz }}</code> placeholders substituted at install time.',
      'The <code>charts/</code> directory holds vendored dependency charts — declared in <code>Chart.yaml</code> and fetched with <code>helm dependency update</code>.',
      'Values resolve with this precedence, highest wins: command-line <code>--set</code> flags &gt; an override file passed via <code>--values</code> &gt; the chart\'s own default <code>values.yaml</code>.',
      'Beyond <code>.Values</code>, templates can reference built-in objects like <code>.Release.Name</code> (the release name given at install time) and <code>.Chart.Version</code> — useful for uniquely naming resources per release.',
    ],
    code: `my-service/                  # chart name = top-level directory name
├── Chart.yaml                 # chart metadata: name, version, appVersion, dependencies
├── values.yaml                # default configuration values
├── charts/                    # vendored dependency charts (if any)
│   └── redis/
├── templates/                 # Kubernetes manifest templates
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── NOTES.txt              # printed to the user after a successful install
└── .helmignore                # files to exclude when packaging the chart

---
# Chart.yaml
apiVersion: v2
name: my-service
description: A Helm chart for my-service
type: application
version: 1.2.0           # the chart's own version
appVersion: "1.0"         # the version of the application it deploys
dependencies:
  - name: redis
    version: "17.x.x"
    repository: https://charts.bitnami.com/bitnami`,
    codeLabel: 'directory + yaml',
    note: {
      label: 'KEY INSIGHT',
      text: 'A chart\'s own version (Chart.yaml\'s version field) and the application\'s version (appVersion) are tracked separately on purpose — you can ship chart 1.2.0 that fixes a templating bug without implying the underlying application itself changed at all.',
      tone: 'green',
    },
    quiz: {
      question: 'You install a chart with <code>helm install my-release ./my-service --values prod-values.yaml --set replicaCount=10</code>. The chart\'s values.yaml sets <code>replicaCount: 2</code>, and prod-values.yaml sets <code>replicaCount: 5</code>. How many replicas actually get created?',
      options: [
        { label: '2, because values.yaml always wins', correct: false },
        { label: '5, because --values always overrides --set', correct: false },
        { label: '10, because --set flags take precedence over both the values file and the chart\'s defaults', correct: true },
        { label: 'Helm throws an error due to conflicting values', correct: false },
      ],
      explanation: 'Helm resolves values with --set flags as the highest-precedence source, overriding any --values file, which in turn overrides the chart\'s own default values.yaml. So the final replicaCount is 10.',
    },
  },
  {
    id: '14.5',
    title: 'Installing & Managing Releases with Helm',
    duration: '7 min',
    kind: 'demo',
    summary: [
      'Using a chart in practice starts with registering a chart repository — <code>helm repo add &lt;name&gt; &lt;url&gt;</code> — and refreshing its index with <code>helm repo update</code> so Helm knows about the latest chart versions available there. From there, <code>helm search repo &lt;keyword&gt;</code> finds candidate charts, and <code>helm show values &lt;chart&gt;</code> lets you inspect every configurable value and its default before you commit to an install.',
      'Every <code>helm install</code> creates a named <strong>release</strong> — a specific, tracked deployment of a chart with a specific set of resolved values. Multiple releases of the same chart can coexist in a cluster (for example, <code>nginx-dev</code> and <code>nginx-staging</code>, both installed from the same <code>bitnami/nginx</code> chart) as long as each has a distinct release name or lives in a different namespace.',
      '<code>helm upgrade &lt;release&gt; &lt;chart&gt;</code> applies new values or a new chart version to an existing release in place — analogous to how <code>kubectl apply</code> reconciles a Deployment without deleting and recreating it. In CI/CD pipelines, the idiom you will actually use is <code>helm upgrade --install &lt;release&gt; &lt;chart&gt;</code>: it installs the release if it does not exist yet, or upgrades it if it does, making a deploy script safe to run identically whether this is the very first deployment or the hundredth.',
      'Because Helm tracks every past revision of a release, <code>helm history &lt;release&gt;</code> lists them, and <code>helm rollback &lt;release&gt; &lt;revision&gt;</code> reverts the release to any specific prior revision from that history — the fastest way to recover from a bad upgrade. <code>helm list</code> shows every release currently installed, and <code>helm uninstall &lt;release&gt;</code> removes a release and, by default, every resource it created. This exact workflow — install, upgrade, roll back if needed — is precisely what powers the Prometheus Operator setup in the next lesson.',
    ],
    keyPoints: [
      '<code>helm repo add &lt;name&gt; &lt;url&gt;</code> registers a chart repository; <code>helm repo update</code> refreshes the local index of available charts and versions.',
      'Every <code>helm install</code> creates a named <strong>release</strong> — a tracked instance of a chart with a specific resolved configuration; the same chart can be installed multiple times under different release names.',
      '<code>helm upgrade --install &lt;release&gt; &lt;chart&gt;</code> is the standard CI/CD idiom: installs the release if it does not exist yet, or upgrades it in place if it does — making deploy scripts idempotent.',
      '<code>helm history &lt;release&gt;</code> lists every past revision; <code>helm rollback &lt;release&gt; &lt;revision&gt;</code> reverts to a specific one, which is only possible because Helm tracks that revision history.',
      '<code>helm uninstall &lt;release&gt;</code> deletes all resources created by that release from the cluster.',
    ],
    code: `# Register and refresh a public chart repository
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Search for available charts matching a keyword
helm search repo nginx

# Inspect a chart's default configurable values before installing
helm show values bitnami/nginx

# Install the chart as a new release named "my-release"
helm install my-release bitnami/nginx --set replicaCount=2

# List all releases currently installed in the current namespace
helm list

# Upgrade an existing release with new values (in place, no downtime gap)
helm upgrade my-release bitnami/nginx --set replicaCount=3

# Idempotent CI/CD idiom: installs if missing, upgrades if it already exists
helm upgrade --install my-release bitnami/nginx --set replicaCount=3

# View the revision history for a release
helm history my-release

# Roll back to revision 1 if the latest upgrade caused problems
helm rollback my-release 1

# Remove the release and all resources it created
helm uninstall my-release`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'helm upgrade --install is the idiom you will actually use in CI/CD pipelines — it means your deploy step does not need to know or check whether this is the first deployment or the hundredth; the command is safe to run every time.',
      tone: 'green',
    },
    quiz: {
      question: 'An upgrade to production goes wrong — the new pods are crash-looping. What is the fastest way to restore the previous working state using Helm?',
      options: [
        { label: 'Manually delete every resource and reapply the old YAML files from memory', correct: false },
        { label: 'Run helm rollback <release> <previous-revision>, using the revision number from helm history', correct: true },
        { label: 'Run helm uninstall followed by a fresh helm install with the old chart version', correct: false },
        { label: 'Edit the running Pods directly with kubectl edit to patch the image tag', correct: false },
      ],
      explanation: 'Helm tracks every release\'s revision history specifically so that helm rollback can revert to a known-good prior revision in one command. Uninstalling and reinstalling is slower and riskier; editing live Pods bypasses the Deployment/chart entirely, and the drift would just be reverted on the next reconciliation anyway.',
    },
  },
  {
    id: '14.6',
    title: 'Monitoring Kubernetes with Prometheus: Core Concepts',
    duration: '7 min',
    kind: 'theory',
    summary: [
      'The Prometheus monitoring stack has three logical layers. At its core is the <strong>Prometheus server</strong>, which stores and processes metrics as time-series data. Layered on top is <strong>Alertmanager</strong>, which turns rule-based conditions on that data into actual notifications — email, Slack, PagerDuty, and so on. Finally there is a visualization layer: Prometheus ships a basic built-in UI, but <strong>Grafana</strong> is the far more common choice for building rich, shareable dashboards on top of Prometheus\'s data.',
      'What defines Prometheus architecturally is its <strong>pull-based</strong> scraping model. Rather than applications pushing metrics to a central collector, Prometheus periodically sends an HTTP GET to a <code>/metrics</code> endpoint that each monitored target exposes, at a configured interval (commonly every 15 seconds), and stores each scraped value as a timestamped data point. This is a deliberate design choice: Prometheus — not the application — controls polling frequency, and it can immediately flag a target as "down" the moment a scrape fails, rather than waiting for the target to actively signal a problem it might not even be aware it has.',
      'Monitoring a Kubernetes cluster is fundamentally different from monitoring a handful of long-lived servers. A traditional setup targets a small, stable, mostly-fixed list of machines. A cluster\'s workloads are the opposite: pods are ephemeral, scale up and down continuously, and get rescheduled with brand-new IPs constantly — and there are multiple distinct layers to watch at once. <strong>Node-level</strong> metrics cover the hardware and OS of each worker node (CPU, memory, disk). <strong>Cluster/object-level</strong> metrics cover the health of Kubernetes objects themselves — how many Deployment replicas are actually Ready, whether a StatefulSet pod is stuck. <strong>Application-level</strong> metrics are whatever custom data your own code chooses to expose. A bare Prometheus install has no visibility into any of the first two layers on its own, which is why two companion tools exist: <code>node-exporter</code>, deployed as a <strong>DaemonSet</strong> so exactly one copy runs on every worker node, translates raw OS/hardware statistics into Prometheus-scrapeable metrics; and <code>kube-state-metrics</code> translates the Kubernetes API\'s live object state (Deployments, Pods, StatefulSets, and more) into metrics of its own.',
      '<strong>PromQL</strong> is the query language used to work with all of this data — the same language powers Alertmanager\'s alerting rules and every panel you build in a Grafana dashboard on top of a Prometheus data source. Getting comfortable reading a handful of basic queries goes a long way before you ever need to write complex ones.',
    ],
    keyPoints: [
      'Prometheus uses a <strong>pull-based</strong> model: it scrapes a <code>/metrics</code> HTTP endpoint on each target at a fixed interval, rather than targets pushing data to it.',
      'The stack has three logical layers: <strong>Prometheus server</strong> (stores/queries metrics), <strong>Alertmanager</strong> (turns metric conditions into notifications), and a <strong>visualization layer</strong> (built-in UI, or more commonly Grafana).',
      'Monitoring a Kubernetes cluster spans three layers simultaneously: <strong>node-level</strong> hardware metrics, <strong>cluster/object-level</strong> health (Deployments, Pods, StatefulSets), and <strong>application-level</strong> custom metrics.',
      '<code>node-exporter</code> (deployed as a DaemonSet, one pod per node) exposes worker-node hardware/OS metrics; <code>kube-state-metrics</code> exposes the health and state of Kubernetes objects themselves.',
      '<strong>PromQL</strong> is Prometheus\'s query language, used both to build alerting rules and to power Grafana dashboard panels.',
    ],
    code: `# A few beginner-level PromQL queries

# Current CPU usage rate (per second) averaged over the last 5 minutes,
# for every container, grouped by pod
rate(container_cpu_usage_seconds_total[5m])

# Number of Pods NOT in the Ready condition right now
kube_pod_status_ready{condition="false"} == 1

# Percentage of Deployment replicas that are actually available
kube_deployment_status_replicas_available
  / kube_deployment_spec_replicas * 100

# Memory usage (bytes) of a specific node
node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes

---
# A minimal scrape config — this is fundamentally what drives Prometheus,
# even though in Kubernetes this gets generated for you by the Prometheus
# Operator (see the next lesson).
scrape_configs:
  - job_name: 'my-app'
    scrape_interval: 15s
    static_configs:
      - targets: ['my-app-service:8080']`,
    codeLabel: 'promql + yaml',
    note: {
      label: 'KEY INSIGHT',
      text: 'A single-server monitoring setup watches a short, stable list of machines. A Kubernetes cluster\'s pods are ephemeral and constantly rescheduled with new IPs — which is exactly why node-exporter and kube-state-metrics exist: they translate the cluster\'s constantly-changing infrastructure and object state into a form Prometheus\'s pull-based scraping can keep up with.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why does monitoring a Kubernetes cluster typically require both node-exporter and kube-state-metrics, rather than just pointing Prometheus at your own application\'s <code>/metrics</code> endpoint?',
      options: [
        { label: 'node-exporter and kube-state-metrics are required just to make Prometheus start at all', correct: false },
        { label: 'Because your application\'s own metrics only cover the application layer — node-exporter adds node hardware metrics and kube-state-metrics adds Kubernetes object health, covering the other two layers a cluster needs visibility into', correct: true },
        { label: 'Because Prometheus cannot scrape custom application metrics at all', correct: false },
        { label: 'Because Kubernetes requires all metrics to be pushed, not pulled', correct: false },
      ],
      explanation: 'Full cluster observability spans three layers: node hardware, Kubernetes object/cluster state, and application-level metrics. Your app\'s /metrics endpoint only covers the last one. node-exporter fills in node-level hardware metrics and kube-state-metrics fills in cluster/object-level health — together with app metrics, that is full-stack visibility.',
    },
  },
  {
    id: '14.7',
    title: 'Setting Up Prometheus via the Prometheus Operator & Helm',
    duration: '10 min',
    kind: 'demo',
    summary: [
      'There are three ways to deploy the Prometheus stack into a Kubernetes cluster. The first is hand-writing every StatefulSet, Deployment, ConfigMap, and Secret it needs yourself — tedious, error-prone, and effort that thousands of other teams have already duplicated. The second is deploying the Prometheus Operator (from lesson 14.2) directly and managing its CRDs by hand. The third — and the one actually used here — is installing a <strong>Helm chart</strong> (from lessons 14.3–14.5) that bundles the Prometheus Operator together with sane default configuration for Prometheus, Alertmanager, Grafana, and the supporting exporters (from 14.6), all in one command. This lesson is where every concept from this final section converges into the setup teams actually run in production.',
      'The install itself is two commands: add the <code>prometheus-community</code> Helm repository, then <code>helm install prometheus prometheus-community/kube-prometheus-stack</code>. That single command creates an entire fleet of resources: two StatefulSets — Prometheus itself and Alertmanager — both managed by the Operator (visible from their <code>prometheus-operated</code> / <code>alertmanager-operated</code> naming); three Deployments — the Prometheus Operator itself, Grafana, and <code>kube-state-metrics</code> (a chart dependency, exactly the kind covered in lesson 14.4); a <strong>DaemonSet</strong> running <code>node-exporter</code> on every worker node; and a large supporting cast of Services, ConfigMaps, Secrets, and CRDs — including the <code>Prometheus</code> and <code>PrometheusRule</code> custom resource kinds from lesson 14.2 — that the Operator manages on your behalf.',
      'It is worth tracing where the default configuration actually lives, because it directly reuses Section 13\'s volume-mounting mechanism. Prometheus\'s own scrape configuration is stored as a <strong>Secret</strong> (not a ConfigMap, since it may reference sensitive endpoint details) and mounted into the main Prometheus container; a default alerting rules file is stored as a <strong>ConfigMap</strong> and mounted the same way. Two small sidecar "config-reloader" containers watch those mounted files and signal Prometheus and Alertmanager to reload live, with no pod restart required, whenever the Operator updates them. This is precisely the ConfigMap/Secret-as-volume pattern from lessons 13.1 and 13.2 — the only difference is that the Operator is now the one editing these objects instead of a person running <code>kubectl edit</code>.',
      'Because every Service the chart creates defaults to <code>ClusterIP</code> (internal-only), reaching Grafana or the Prometheus UI directly from your browser requires either an Ingress (covered earlier in the course) in production, or <code>kubectl port-forward</code> for local exploration. Grafana\'s default login is username <code>admin</code>, with the password readable from the chart\'s default values or the Secret it generates. Once inside, Grafana\'s pre-built dashboards already show both node-level metrics (from node-exporter) and Kubernetes object metrics (from kube-state-metrics) with zero additional configuration — the "out of the box" promise from the previous lesson, delivered. That single <code>helm install</code> command is a fitting place to close out the course: it quietly depends on nearly everything covered across both parts — a container image (Docker) running as a Pod, kept alive by controllers like Deployment, StatefulSet, and DaemonSet, configured through ConfigMaps and Secrets mounted as volumes, exposed through Services, storing state safely via PersistentVolumeClaims, its complex lifecycle managed by an Operator, and the entire package installed and upgraded through Helm. None of that is magic once you have built it up piece by piece — it is just the sum of everything this course walked through, one concept at a time.',
    ],
    keyPoints: [
      'The Prometheus Operator\'s Helm chart (<code>kube-prometheus-stack</code>) installs the entire monitoring stack — Prometheus, Alertmanager, Grafana, node-exporter, kube-state-metrics, and the Operator itself — with one <code>helm install</code>.',
      'Resulting resources include two Operator-managed StatefulSets (Prometheus, Alertmanager), Deployments (Operator, Grafana, kube-state-metrics), and a <strong>DaemonSet</strong> (node-exporter, one pod per node).',
      'Prometheus\'s live scrape configuration is stored as a <strong>Secret</strong> and its alert rules as a <strong>ConfigMap</strong>, both mounted as volumes into the Prometheus pod — the same mechanism from Section 13, just managed automatically by the Operator\'s config-reloader sidecar containers.',
      'Because every Service in the chart defaults to <code>ClusterIP</code>, use <code>kubectl port-forward</code> for local access to Grafana/Prometheus\'s UIs, or configure an Ingress for real external access in production.',
      'Out of the box — with zero extra configuration — you get both node-level hardware monitoring and Kubernetes object-level health monitoring, thanks to node-exporter and kube-state-metrics being installed as chart dependencies.',
    ],
    code: `# Add the community repository that hosts the kube-prometheus-stack chart
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install the entire monitoring stack under the release name "prometheus"
helm install prometheus prometheus-community/kube-prometheus-stack

# See everything the chart created
kubectl get all
kubectl get configmap
kubectl get secret
kubectl get crd | grep monitoring.coreos.com

# Inspect the generated Prometheus configuration (stored as a Secret)
kubectl get statefulset prometheus-prometheus-kube-prometheus-prometheus -o yaml > prometheus-sts.yaml
kubectl get secret prometheus-prometheus-kube-prometheus-prometheus -o yaml > prometheus-secret.yaml

# Access Grafana locally (default Service is ClusterIP-only)
kubectl port-forward deployment/prometheus-grafana 3000:3000
# open http://localhost:3000 — default user "admin",
# password from: helm show values prometheus-community/kube-prometheus-stack | grep -A2 adminPassword

# Access the Prometheus UI locally
kubectl port-forward deployment/prometheus-kube-prometheus-operator 9090:9090

# Clean up when you're done exploring
helm uninstall prometheus`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'One helm install command here quietly relies on everything this course covered: Docker images running as Pods, Deployments/StatefulSets/DaemonSets keeping them alive, ConfigMaps and Secrets mounted as volumes for configuration, an Operator managing application-specific lifecycle, and Helm tying it all together into one reusable, versioned package. That is the payoff of learning the individual pieces first.',
      tone: 'green',
    },
    quiz: {
      question: 'After running <code>helm install prometheus prometheus-community/kube-prometheus-stack</code>, you cannot reach the Grafana UI by visiting a cluster IP directly from your browser. Why not, and what is the standard way to access it for local exploration?',
      options: [
        { label: 'The install failed silently; you should reinstall the chart', correct: false },
        { label: 'Grafana\'s Service defaults to ClusterIP (internal-only) — use kubectl port-forward to reach it locally, or configure an Ingress for real external access', correct: true },
        { label: 'Grafana does not expose a web UI in this chart, only an API', correct: false },
        { label: 'The chart never creates a Service for Grafana, so you must create a NodePort Service yourself from scratch', correct: false },
      ],
      explanation: 'The chart\'s Services are ClusterIP by default, which is only reachable from inside the cluster network. kubectl port-forward is the standard tool for temporary local access without changing the Service type; in production, you would typically front it with an Ingress instead.',
    },
  },
]
