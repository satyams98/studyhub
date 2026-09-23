export default [
  {
    id: '12.1',
    title: 'What Are Namespaces & Why Use Them',
    duration: '7 min',
    kind: 'theory',
    summary: [
      'A namespace is a way of partitioning a single physical Kubernetes cluster into multiple virtual clusters. Every resource created so far in this course — every Pod, Service, and Ingress from the previous section — actually lives inside some namespace, whether one was ever specified or not: anything you do not explicitly place elsewhere quietly lands in a namespace literally called <code>default</code>. The next lesson covers exactly which namespaces exist out of the box and precisely which resource kinds are namespace-scoped at all; this lesson is about why you would bother creating your own.',
      'The first, simplest motivation is <strong>organization</strong>. A small application might only need a couple of Deployments and a Service, and dumping all of that into the default namespace is harmless. But as an application grows — several Deployments creating pod replicas, plus Services, ConfigMaps, and Secrets for each — the default namespace fills up fast, and it becomes genuinely difficult to get an overview of what is running and why, especially once more than one person is creating resources there. The fix is to group resources logically into namespaces that match their purpose: a <code>database</code> namespace for a database and its supporting resources, a <code>monitoring</code> namespace for Prometheus and Grafana, an <code>elastic-stack</code> namespace for Elasticsearch and its logging pipeline, an <code>ingress-nginx</code> namespace for the Ingress Controller from section 11. Anyone looking at the list of namespaces can then immediately understand the cluster\'s overall shape.',
      'The second motivation is avoiding <strong>collisions between teams</strong> sharing one cluster. If Team A and Team B both create a Deployment named <code>checkout-service</code> — with entirely different configurations — in the same namespace, the second <code>kubectl apply</code> silently overwrites the first team\'s Deployment outright. Kubernetes does not reject the second apply, does not merge the two, and does not rename anything; it simply replaces the resource that already had that name. If either team deploys through an automated pipeline, they may not even notice the collision happened until production traffic starts failing. Giving each team its own namespace means resource names only need to be unique <em>within</em> that namespace, not across the whole cluster, which eliminates this entire class of accident.',
      'The third motivation is running multiple <strong>environments</strong>, or multiple production versions, in a single cluster instead of provisioning a separate cluster for each. A <code>staging</code> namespace and a <code>development</code> namespace can coexist in one cluster while both still using the same shared, cluster-wide infrastructure — an Ingress Controller, a logging stack — without duplicating that infrastructure per environment. The identical trick underlies <strong>blue/green deployments</strong>: a <code>blue-production</code> namespace holding the version of the application currently serving live traffic, and a <code>green-production</code> namespace holding the next version being staged, both able to reach the same shared resources, letting you cut traffic over between them without duplicating your entire infrastructure stack.',
      'The fourth motivation is <strong>access control and resource limits</strong>. A namespace is the unit Kubernetes uses for RBAC (role-based access control): you can grant a team permission to create, update, and delete resources only inside its own namespace, so a mistake in one team\'s namespace cannot touch another team\'s workloads at all. Namespaces are also the unit for resource quotas, letting you cap the total CPU, memory, and storage one namespace is allowed to consume, so that one team\'s runaway workload cannot starve every other team sharing a resource-constrained cluster. Kubernetes\' own official guidance suggests that very small projects — roughly under ten users — do not strictly need custom namespaces. In practice, though, even small projects tend to accumulate a logging stack, a monitoring stack, and other supporting infrastructure faster than expected, so treating namespaces as day-one hygiene, rather than something retrofitted onto a live, already-crowded default namespace later, is generally the safer default.',
    ],
    keyPoints: [
      'A namespace is a <strong>virtual cluster</strong> inside a physical cluster — every resource lives in exactly one namespace (or none, for cluster-scoped resources — covered next lesson).',
      'Use namespaces to <strong>organize</strong> a growing application\'s resources (e.g. <code>database</code>, <code>monitoring</code>, <code>elastic-stack</code>) so the cluster stays understandable as it grows.',
      'Namespaces prevent <strong>naming collisions</strong> between teams sharing one cluster — two teams can each have a Deployment with the same name without one silently overwriting the other.',
      'One cluster can host multiple <strong>environments</strong> (staging/development) or <strong>blue/green production</strong> versions in separate namespaces while still sharing common infrastructure like an Ingress Controller.',
      'Namespaces are the boundary for <strong>RBAC access control</strong> and <strong>resource quotas</strong>, isolating teams and preventing one workload from starving the whole cluster.',
    ],
    code: `$ kubectl get namespaces
NAME              STATUS   AGE
default           Active   40d
database          Active   12d
monitoring        Active   12d
elastic-stack     Active   9d
ingress-nginx     Active   9d
staging           Active   30d
blue-production   Active   3d
green-production  Active   3d`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Two teams both naming a Deployment `checkout-service` sounds unlikely — until it happens through an automated CI/CD pipeline neither team is watching closely, silently overwriting each other\'s production workload. Namespaces make names collision-proof by scoping them.',
      tone: 'accent',
    },
    quiz: {
      question: 'Team A and Team B share one Kubernetes cluster with no custom namespaces. Both independently `kubectl apply` a Deployment named `checkout-service` with different container images. What happens?',
      options: [
        { label: 'Kubernetes rejects the second apply with a naming conflict error', correct: false },
        { label: 'Kubernetes creates two separate Deployments and load-balances between both images', correct: false },
        { label: 'The second apply silently overwrites the first team\'s Deployment, since resource names must be unique per namespace, not per cluster', correct: true },
        { label: 'Kubernetes automatically renames the second Deployment to `checkout-service-2`', correct: false },
      ],
      explanation: 'Resource names only need to be unique within a single namespace, not across the whole cluster. With both teams using the default namespace, the second team\'s apply overwrites the first team\'s Deployment outright — no error, no warning, and no auto-renaming — which is exactly the failure mode that giving each team its own namespace is meant to prevent.',
    },
  },
  {
    id: '12.2',
    title: 'Default Namespaces & Resource Scoping',
    duration: '7 min',
    kind: 'concept',
    summary: [
      'Every fresh Kubernetes cluster ships with a small set of built-in namespaces, visible immediately with <code>kubectl get namespaces</code>. <code>kube-system</code> is reserved for Kubernetes\' own system processes — control plane components, <code>kube-proxy</code>, CoreDNS, and similar — and you should not create or modify resources inside it yourself. <code>kube-public</code> holds data meant to be publicly readable across the entire cluster, even without authentication; the most common example is a ConfigMap containing cluster information, which is exactly what backs the <code>kubectl cluster-info</code> command. <code>kube-node-lease</code> is a comparatively recent addition holding one lease object per node, used to track that node\'s heartbeat so the control plane can quickly tell whether a node has stopped responding. <code>default</code> is the namespace every resource lands in when you do not explicitly specify one — where your own experiments live until you decide to organize them elsewhere, following the reasoning from the previous lesson. If you are following along on Minikube specifically, you will also see a <code>kubernetes-dashboard</code> namespace; that one is a Minikube-specific convenience add-on, not something a standard cluster ships with.',
      'Not every kind of resource can even live inside a namespace. Most everyday resources are <strong>namespaced</strong>: Pods, Deployments, Services, ConfigMaps, Secrets, and the Ingress objects from section 11 all belong to exactly one namespace. A handful of resource kinds, however, are <strong>cluster-scoped</strong> and cannot be placed inside any namespace at all — a <code>Node</code> (a worker machine is part of the whole cluster\'s inventory, not scoped to any one team) and a <code>PersistentVolume</code> (the underlying storage resource itself) are the two most common examples. Note the distinction with a <code>PersistentVolumeClaim</code>, which <em>is</em> namespaced, since a claim represents one namespace\'s specific request to use some of that cluster-wide storage. Running <code>kubectl api-resources --namespaced=false</code> lists every cluster-scoped resource kind directly, which is the fastest way to check whether a particular Kind can be namespaced at all before you go looking for it inside one.',
      'The scoping rule that catches almost every beginner at least once: ConfigMaps and Secrets do <strong>not</strong> automatically cross namespace boundaries, even when they logically reference something shared. If a <code>database</code> namespace holds a ConfigMap with a shared database\'s connection string, and a Pod in an unrelated <code>analytics</code> namespace needs that exact same value, you cannot reference the <code>database</code> namespace\'s ConfigMap from <code>analytics</code> — you must create an equivalent ConfigMap inside <code>analytics</code> too, duplicating the value. A <strong>Service</strong> is the one major exception: it can be reached from another namespace via an extended DNS name that appends the namespace onto the Service name — <code>&lt;service-name&gt;.&lt;namespace-name&gt;</code>, or written out in full, <code>&lt;service-name&gt;.&lt;namespace-name&gt;.svc.cluster.local</code>. This is exactly how a Pod in one namespace can transparently keep using a shared Elasticsearch deployment, or the Ingress Controller\'s internal Service, that physically lives in a completely different namespace, without needing that namespace\'s other resources duplicated alongside it.',
    ],
    keyPoints: [
      'Every cluster ships with four built-in namespaces: <code>kube-system</code> (system components — do not touch), <code>kube-public</code> (publicly readable cluster info, backs <code>kubectl cluster-info</code>), <code>kube-node-lease</code> (per-node heartbeat objects), and <code>default</code> (where unscoped resources land).',
      'Minikube additionally ships a <code>kubernetes-dashboard</code> namespace — that one is Minikube-specific, not a standard cluster feature.',
      'Most resources (Pods, Deployments, Services, ConfigMaps, Secrets, Ingress) are <strong>namespaced</strong>; a few, like <code>Node</code> and <code>PersistentVolume</code>, are <strong>cluster-scoped</strong> and cannot live inside any namespace.',
      '<code>kubectl api-resources --namespaced=false</code> lists every cluster-scoped resource kind.',
      '<strong>ConfigMaps and Secrets never cross namespaces</strong> — the same value must be duplicated into every namespace that needs it. <strong>Services are the exception</strong> — reachable cross-namespace via <code>&lt;service-name&gt;.&lt;namespace&gt;.svc.cluster.local</code>.',
    ],
    code: `$ kubectl get namespaces
NAME              STATUS   AGE
default           Active   40d
kube-node-lease   Active   40d
kube-public       Active   40d
kube-system       Active   40d

$ kubectl cluster-info
Kubernetes control plane is running at https://192.168.49.2:8443
CoreDNS is running at https://192.168.49.2:8443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy

$ kubectl api-resources --namespaced=false
NAME                SHORTNAMES   APIVERSION   NAMESPACED   KIND
namespaces          ns           v1           false        Namespace
nodes               no           v1           false        Node
persistentvolumes   pv           v1           false        PersistentVolume`,
    codeLabel: 'terminal',
    note: {
      label: 'WARNING',
      text: '`kube-system` holds the cluster\'s own control-plane components. Creating, editing, or deleting resources there by hand can destabilize the entire cluster, not just one namespace.',
      tone: 'accent',
    },
    quiz: {
      question: 'A ConfigMap named `db-config` exists in the `database` namespace with a connection string an application needs. A Pod in the `analytics` namespace tries to mount it and fails. What is the correct fix?',
      options: [
        { label: 'Reference it as `db-config.database` in the analytics Pod\'s volume spec', correct: false },
        { label: 'Create an equivalent ConfigMap named `db-config` inside the `analytics` namespace as well', correct: true },
        { label: 'Move the Pod into the `database` namespace', correct: false },
        { label: 'Grant the `analytics` namespace RBAC access to `database`\'s ConfigMaps', correct: false },
      ],
      explanation: 'ConfigMaps and Secrets are strictly namespace-scoped and cannot be referenced across namespaces — not with a dotted name, and not through an RBAC grant, since RBAC controls who may act on a resource, not which namespace it is visible from. The only Kubernetes resource with built-in cross-namespace addressing is a Service. A running Pod also cannot be "moved" between namespaces at all — it would have to be deleted and recreated elsewhere, which just relocates the problem. The actual fix is to duplicate the ConfigMap into the namespace that needs it.',
    },
  },
  {
    id: '12.3',
    title: 'Working Across Namespaces: kubectl -n & Cross-Namespace DNS',
    duration: '8 min',
    kind: 'demo',
    summary: [
      'A namespace can be created two ways. Imperatively, <code>kubectl create namespace my-namespace</code> creates one immediately with a single command — convenient for a quick, throwaway experiment. Declaratively, a namespace manifest applied with <code>kubectl apply -f namespace.yaml</code> achieves the same result, but the definition now lives in version control alongside the rest of your manifests, giving you a durable, reviewable history of when and why the namespace was created — the same "manifest over ad-hoc command" reasoning that applies to every other Kubernetes resource in this course.',
      'Once a namespace exists, there are two ways to actually put a resource inside it. The first is leaving the resource\'s own YAML untouched and passing <code>--namespace=my-namespace</code> (or the shorthand <code>-n my-namespace</code>) on the <code>kubectl apply</code> command line. The second is adding a <code>namespace</code> field directly inside the resource\'s own <code>metadata</code> block, so the file is self-describing. The second approach is the better default for two concrete reasons: it is self-documenting, since anyone reading the file alone can see exactly where it will land without checking how it happens to be applied, and it plays far better with automated deployment pipelines, where nobody wants to remember to append the correct <code>-n</code> flag to every single <code>kubectl apply</code> invocation across dozens of files.',
      'Querying resources works under the identical rule, and it is the part that catches almost every beginner at least once: <code>kubectl get pods</code> with no namespace flag is not "every pod in the cluster" — it is shorthand for <code>kubectl get pods --namespace=default</code>. If a Pod actually lives in <code>my-namespace</code>, that same bare command reports <code>No resources found in default namespace.</code>, even though the Pod is running perfectly well — you have to add <code>-n my-namespace</code> explicitly, every time, for every <code>kubectl</code> command that operates on a namespaced resource.',
      'This is also where cross-namespace Service DNS, introduced in the previous lesson, becomes a concrete, practical tool. A Pod in a <code>web</code> namespace that needs to reach a shared MySQL Service actually deployed in a <code>database</code> namespace connects to <code>mysql-service.database</code> (or, written out fully, <code>mysql-service.database.svc.cluster.local</code>) — no additional networking configuration required, since cluster DNS resolves both forms automatically, exactly the same way it resolves a same-namespace Service by its bare name.',
      'Finally, for anyone who works heavily inside one namespace at a time, switching a namespace back and forth with <code>-n</code> on every command gets old fast. <code>kubectl</code> itself has no built-in way to change your "current" default namespace, but the third-party <code>kubens</code> tool — installed alongside <code>kubectx</code>, for example with <code>brew install kubectx</code> on macOS — does exactly that. Running <code>kubens</code> alone lists every namespace and highlights whichever one is currently active; running <code>kubens my-namespace</code> switches your active context\'s default namespace, so that every subsequent bare <code>kubectl</code> command targets <code>my-namespace</code> automatically until you switch again.',
    ],
    keyPoints: [
      'Create namespaces declaratively with a manifest (<code>kubectl apply -f namespace.yaml</code>) rather than imperatively, so the creation is tracked in version control like every other resource.',
      'Put a resource into a namespace either with <code>--namespace</code>/<code>-n</code> on the command line, or (preferred) with a <code>namespace</code> field inside the resource\'s own <code>metadata</code> — the latter is self-documenting and pipeline-friendly.',
      '<code>kubectl get pods</code> with no namespace flag is <strong>shorthand for <code>-n default</code></strong>, not "every pod in the cluster" — the most common "where did my pod go" beginner mistake.',
      'Reach a Service in another namespace via <code>&lt;service-name&gt;.&lt;namespace&gt;</code> (or the full <code>...svc.cluster.local</code> form) — no additional networking setup required.',
      'The third-party <code>kubens</code> tool lets you switch your shell\'s active/default namespace so you stop needing <code>-n</code> on every command.',
    ],
    code: `apiVersion: v1
kind: Namespace
metadata:
  name: my-namespace
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: my-namespace
data:
  APP_MODE: production`,
    codeLabel: 'yaml',
    note: {
      label: 'KEY INSIGHT',
      text: 'A bare `kubectl get pods` is not "show me everything" — it is always scoped to a namespace, defaulting silently to `default`. Half of "my resource disappeared" confusion is really "my resource is in a different namespace than the one I am looking at."',
      tone: 'green',
    },
    quiz: {
      question: 'A Pod named `checkout-worker` was created in the `billing` namespace. Without switching your active namespace, which command correctly lists it?',
      options: [
        { label: '`kubectl get pods --context billing`', correct: false },
        { label: '`kubectl get pods -n billing`', correct: true },
        { label: '`kubectl get pods` (no flags — kubectl searches every namespace by default)', correct: false },
        { label: '`kubectl get pods --all-namespaces=billing`', correct: false },
      ],
      explanation: '`kubectl get pods` with no flag defaults to the `default` namespace, not every namespace, so it would report no resources found. `--context` switches which entire cluster/user configuration kubectl talks to, not which namespace within the current cluster — it is not a namespace filter. `--all-namespaces` (or `-A`) is a boolean flag that lists every namespace at once and does not take a namespace name as a value. The correct, explicit way to target one specific namespace is `-n billing` (or `--namespace=billing`).',
    },
  },
  {
    id: '12.4',
    title: 'When (and When Not) to Use Namespaces',
    duration: '6 min',
    kind: 'faq',
    summary: [
      '<strong>"Do I need namespaces for a small side project?"</strong> Kubernetes\' own documentation suggests that projects with roughly under ten users do not strictly need custom namespaces, and for a genuinely disposable experiment, the default namespace is fine. But most real projects — even small ones — accumulate a logging stack, a monitoring stack, or a second environment faster than expected, and retrofitting namespaces onto a cluster that already has dozens of unnamespaced resources tangled together is considerably more painful than starting with a small, sensible set from day one. Reach for namespaces once you can name a concrete reason from lesson 12.1 — multiple teams, multiple environments, blue/green production, or a need for per-team resource quotas and access control — rather than waiting until the default namespace is already too crowded to reason about.',
      '<strong>"Can two namespaces share a ConfigMap or a Secret?"</strong> No. As covered in lesson 12.2, ConfigMaps and Secrets are strictly scoped to the namespace they were created in and cannot be referenced from another one — the identical value has to be created again in every namespace that needs it. The one resource kind that genuinely is reachable across namespaces is a <strong>Service</strong>, via <code>&lt;service-name&gt;.&lt;namespace&gt;.svc.cluster.local</code>. This asymmetry is worth remembering on its own: it is the difference between "why can\'t my Pod see this shared database URL" (ConfigMap — duplicate it) and "why can my Pod already reach that other team\'s Elasticsearch cluster without me configuring anything" (Service — it just works).',
      '<strong>"What can\'t namespaces isolate?"</strong> A handful of resource kinds are cluster-scoped and sit outside every namespace entirely — <code>Node</code> and <code>PersistentVolume</code> being the two most common examples from lesson 12.2. No amount of namespace planning changes that a cluster has one shared pool of worker nodes and one shared pool of underlying storage volumes; namespaces partition how those shared resources get <em>consumed</em> — through quotas — not the resources themselves.',
      '<strong>"How do I actually stop one team from starving the cluster\'s resources?"</strong> A <code>ResourceQuota</code> object, created inside a specific namespace, caps the total CPU, memory, and object count that namespace is allowed to consume across all its Pods combined. Paired with the RBAC access control from lesson 12.1 — granting a team permission only within its own namespace — this is what actually makes "give each team a safe, isolated slice of a shared cluster" a real, enforced guarantee rather than just a naming convention.',
    ],
    keyPoints: [
      'Use namespaces when there are multiple teams on one cluster, multiple environments (staging/dev) in one cluster, blue/green production, or a need for per-team RBAC and resource quotas.',
      'Do not over-engineer a genuinely tiny, single-person experiment — but most projects grow into needing namespaces faster than expected, so treat them as day-one hygiene rather than a later retrofit.',
      '<strong>Services</strong> are reachable across namespaces via <code>&lt;service-name&gt;.&lt;namespace&gt;.svc.cluster.local</code>; <strong>ConfigMaps and Secrets are not</strong> and must be duplicated per namespace.',
      '<code>Node</code> and <code>PersistentVolume</code> are cluster-scoped and sit outside every namespace — namespaces govern consumption of shared resources, not the resources themselves.',
      'A <code>ResourceQuota</code> per namespace caps CPU/memory/object counts, and paired with RBAC, is what actually enforces isolation between teams on a shared cluster.',
    ],
    code: `apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: my-namespace
spec:
  hard:
    requests.cpu: '4'
    requests.memory: 8Gi
    limits.cpu: '8'
    limits.memory: 16Gi
    pods: '20'`,
    codeLabel: 'yaml',
    note: {
      label: 'DECISION POINT',
      text: 'If you can point to a specific team, environment, or compliance boundary that a mistake in the default namespace could cross, that is your signal to create a namespace now — not after the first cross-team incident makes the case for you.',
      tone: 'accent',
    },
    quiz: {
      question: 'A cluster hosts three teams, each with unpredictable, occasionally spiky CPU usage. Which combination of features actually prevents one team\'s spike from starving the other two?',
      options: [
        { label: 'Separate namespaces per team alone, with no other configuration', correct: false },
        { label: 'A `ResourceQuota` in each team\'s namespace, capping how much CPU/memory that namespace can consume in total', correct: true },
        { label: 'A headless Service in each namespace', correct: false },
        { label: 'Renaming each team\'s Deployments to avoid collisions', correct: false },
      ],
      explanation: 'Namespaces alone only organize resources and prevent naming collisions — they place no limit on how much CPU or memory the Pods inside a namespace can actually consume, so one team could still starve the cluster. A `ResourceQuota` is the object that caps a namespace\'s total resource consumption, which is what actually protects the other teams. Headless Services address direct Pod addressing, not resource limits, and avoiding name collisions is a separate benefit of namespaces unrelated to CPU or memory usage.',
    },
  },
]
