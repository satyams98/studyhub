export default [
  {
    id: '9.1',
    title: 'Minikube: Running a Kubernetes Cluster Locally',
    duration: '7 min',
    kind: 'theory',
    summary: [
      'A real production Kubernetes cluster is made of several genuinely separate machines. There are usually at least two <strong>master nodes</strong> (the control plane, kept in pairs or more for high availability) and several <strong>worker nodes</strong> that actually run your application pods. Each of those nodes is its own physical or virtual machine, with its own CPU, memory, and disk. That is exactly the setup you want in production, but it is a terrible fit for trying something out on your laptop: spinning up five or six machines just to test whether a Deployment YAML file is correct would be slow, resource-hungry, and for most people simply impossible without a cloud account.',
      'That gap is exactly what <strong>Minikube</strong> exists to close. Minikube is an open-source tool that packages an entire Kubernetes cluster — both the master (control plane) processes and the worker processes — onto a <em>single node</em>. That one node runs inside a lightweight virtual machine (or, with newer setups, a container) that Minikube creates and manages on your own computer. Critically, that node already has a container runtime pre-installed, so you can create pods and run containers on it immediately, even if you have never installed Docker separately on your host machine.',
      'To summarize precisely: Minikube is a one-node Kubernetes cluster that runs inside a VM on your laptop, purely for local testing. It is not a scaled-down production cluster and was never meant to be one — there is no real high availability, since everything lives on one node, and if that node goes down, the whole cluster goes down with it. Use it to practice <code>kubectl</code> commands, experiment with manifests, and verify your configuration before it ever touches a real cloud-managed cluster like EKS, GKE, or AKS.',
      'Once this single-node cluster is running, you still need a way to actually talk to it — to create components, check their status, and configure them. Minikube itself only handles starting, stopping, and deleting the cluster as a whole; everything else happens through a separate command-line tool, which the next lesson introduces.',
    ],
    keyPoints: [
      'Minikube runs an entire Kubernetes control plane and worker role together on <strong>one node</strong>, unlike a real cluster\'s separate master and worker machines.',
      'That single node boots inside a virtual machine (or container) managed locally by Minikube, using a driver such as VirtualBox, HyperKit, or Docker.',
      'The node ships with a container runtime already installed, so pods run immediately even without a separate Docker installation.',
      'Minikube is a <strong>local development and testing tool only</strong> — it has no real high availability and should never run a production workload.',
      'Minikube manages the cluster\'s lifecycle (start, stop, delete); creating and configuring components inside it is a separate tool\'s job, covered next.',
    ],
    code: `# A typical production cluster
Master Node 1     Master Node 2            <- control plane, kept in pairs for HA
Worker Node 1   Worker Node 2   Worker Node 3   <- run your application pods

# Minikube, running locally on your laptop
Single Node (inside a VM/container)
 |- control plane processes (API server, scheduler, controller-manager, etcd)
 |- worker processes (kubelet, kube-proxy)
 \`- container runtime (pre-installed)`,
    codeLabel: 'text',
    note: {
      label: 'WHEN TO USE',
      text: 'Reach for Minikube whenever you want to try a manifest, practice kubectl, or debug a component locally before it goes anywhere near a shared or production cluster. Never use it to host anything real.',
      tone: 'accent',
    },
    quiz: {
      question: 'What is the key architectural difference between a production Kubernetes cluster and a Minikube cluster?',
      options: [
        { label: 'Minikube runs both control-plane and worker processes on a single node, while production clusters spread them across multiple separate machines', correct: true },
        { label: 'Minikube does not use containers at all', correct: false },
        { label: 'Minikube can only run one pod at a time', correct: false },
        { label: 'Minikube requires a cloud provider account to start', correct: false },
      ],
      explanation: 'Minikube collapses the master and worker roles that a production cluster spreads across many machines onto one local node running in a VM. It can still run multiple pods, needs no cloud account, and is built entirely on the same container runtime concepts as a production cluster.',
    },
  },
  {
    id: '9.2',
    title: 'Installing kubectl & Minikube',
    duration: '8 min',
    kind: 'setup',
    summary: [
      'Every Kubernetes cluster has an <strong>API server</strong>, one of the master processes, and it is the single entry point into the cluster. If you want to create a component, check a status, or change any configuration, that request has to go through the API server. There are three common ways to talk to it: a graphical dashboard, direct HTTP calls to the Kubernetes API, or a command-line tool called <code>kubectl</code>. Of the three, <code>kubectl</code> is the most powerful — nearly anything you can do in Kubernetes, you can do with <code>kubectl</code> — and it is what this entire course uses from here on.',
      'An important detail that is easy to miss: <code>kubectl</code> is not a Minikube-specific tool. It talks to the API server of <em>any</em> Kubernetes cluster — Minikube on your laptop today, a managed cloud cluster tomorrow, or a hybrid on-premises setup. Every command you practice against Minikube in this course transfers directly to production work later without any changes.',
      'Because Minikube\'s single node runs isolated from your host operating system, it needs a driver — a hypervisor such as VirtualBox or HyperKit, or, on newer setups, the Docker driver — to actually create and run that node. Install a driver first, then install Minikube itself. Minikube can install <code>kubectl</code> as a dependency automatically, but it is worth installing <code>kubectl</code> explicitly and separately: that way you control exactly which version you get, decoupled from Minikube\'s own release cycle.',
      'Once everything is installed, <code>minikube start</code> boots the local cluster, telling Minikube which driver to use. From that point, <code>kubectl</code> is automatically configured to talk to the Minikube cluster. If the cluster refuses to start, <code>minikube delete</code> tears down the broken cluster completely, and restarting with verbose/debug flags prints exactly what is failing, instead of leaving you guessing.',
    ],
    keyPoints: [
      'The <strong>API server</strong> is the single entry point into a Kubernetes cluster; a dashboard, raw API calls, and <code>kubectl</code> all ultimately talk to it.',
      '<code>kubectl</code> works against <strong>any</strong> Kubernetes cluster — Minikube, a cloud provider, or on-premises — it is not tied to Minikube specifically.',
      'Minikube needs a driver/hypervisor (for example <code>--driver=hyperkit</code>, <code>--driver=virtualbox</code>, or <code>--driver=docker</code>) because its node runs isolated from your host OS.',
      '<code>minikube start</code> creates and boots the local cluster; <code>minikube status</code> and <code>minikube delete</code> check and tear it down — everything else is done through <code>kubectl</code>.',
      '<code>kubectl version</code> printing both a <em>Client Version</em> and a <em>Server Version</em> confirms <code>kubectl</code> is correctly connected to the cluster.',
    ],
    code: `# 1. Install a hypervisor/driver (macOS example, via Homebrew)
brew install hyperkit

# 2. Install Minikube
brew install minikube

# 3. Install kubectl explicitly (recommended over relying on Minikube's bundled copy)
brew install kubectl

# 4. Start the local cluster, telling Minikube which driver to use
minikube start --driver=hyperkit

# 5. Verify the node is up
kubectl get nodes
# NAME       STATUS   ROLES    AGE   VERSION
# minikube   Ready    master   45s   v1.17.0

# 6. Cross-check with Minikube's own status command
minikube status
# host: Running
# kubelet: Running
# apiserver: Running
# kubeconfig: Configured

# 7. Confirm kubectl is talking to the right cluster/version
kubectl version --short
# Client Version: v1.17.0
# Server Version: v1.17.0

# If something goes wrong, wipe the cluster and restart in verbose/debug mode:
minikube delete
minikube start --driver=hyperkit --alsologtostderr -v=7`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: 'kubectl always talks to the API server, never directly to nodes or containers — that is true whether the cluster behind it is Minikube on your laptop or a two-hundred-node production cluster in the cloud.',
      tone: 'accent',
    },
    quiz: {
      question: 'Why is it significant that kubectl is not tied specifically to Minikube?',
      options: [
        { label: 'The exact same kubectl commands and manifests you practice locally will work unchanged against a real cloud or on-premises cluster', correct: true },
        { label: 'It means you never need to install Minikube', correct: false },
        { label: 'It means kubectl can create virtual machines on its own', correct: false },
        { label: 'It means you can skip installing a driver/hypervisor', correct: false },
      ],
      explanation: 'kubectl is a universal Kubernetes client. Everything you learn practicing against Minikube — get, describe, apply, delete, and the manifests you write later — carries over directly to any real cluster, which is exactly why the tool is worth learning thoroughly now.',
    },
  },
  {
    id: '9.3',
    title: 'kubectl Basic Commands: get, describe, apply, delete',
    duration: '9 min',
    kind: 'concept',
    summary: [
      'With the cluster reachable, kubectl exposes a small, consistent set of verbs that work the same way no matter which kind of resource you are pointing them at — a pod, a Deployment, a Service, a node, all of it. <code>get</code> lists resources and shows their current status, <code>describe</code> shows detailed configuration and history for one specific resource, <code>create</code>/<code>apply</code> create or update a resource, and <code>delete</code> removes one. That consistency is what makes kubectl fast to pick up: learn the verbs once, and they apply to every resource type you will ever touch.',
      '<code>kubectl get &lt;resource&gt;</code> is the command you will run constantly. By default it prints a compact table — name, a short status, and age. Adding <code>-o wide</code> prints extra columns that the default view hides, such as a pod\'s internal IP address and which node it landed on. Adding <code>-o yaml</code> instead prints the resource\'s entire manifest exactly as Kubernetes stored it, including fields it generated automatically. <code>kubectl get all</code> is a convenient shortcut that lists every resource type in the current namespace at once, and you can narrow it further by filtering on a name substring.',
      '<code>kubectl describe &lt;resource&gt; &lt;name&gt;</code> is the command you reach for when something is <em>not</em> working. Unlike <code>get</code>, which only tells you the current status word (like <code>ContainerCreating</code> or <code>CrashLoopBackOff</code>), <code>describe</code> also prints a chronological <strong>Events</strong> log — a running commentary of everything Kubernetes has tried to do with that resource, in order, including the actual error message when something failed. When a pod is stuck, this Events section is almost always where the real explanation is hiding.',
      'Finally, <code>create</code> and <code>delete</code> round out the basic CRUD set. <code>kubectl create</code> is imperative — a one-off command that creates exactly one thing. <code>kubectl apply -f file.yaml</code> is declarative and idempotent: applying the same unchanged file twice is a safe no-op (Section 10 covers this in full). <code>kubectl delete &lt;resource&gt; &lt;name&gt;</code> removes a resource, and deleting a Deployment cascades automatically, removing its ReplicaSet and Pods along with it — you never have to delete those layers individually.',
    ],
    keyPoints: [
      '<code>kubectl get &lt;resource&gt;</code> lists resources and their status; add <code>-o wide</code> for extra columns like pod IP, or <code>-o yaml</code> for the full manifest.',
      '<code>kubectl get all</code> lists every resource type in the current namespace in one command.',
      '<code>kubectl describe &lt;resource&gt; &lt;name&gt;</code> is the primary debugging command — it shows configuration <em>and</em> a chronological <strong>Events</strong> log explaining what Kubernetes has actually tried to do.',
      '<code>kubectl create</code> issues a one-off imperative command; <code>kubectl apply -f file.yaml</code> is declarative and idempotent — running it twice with no changes does nothing (fully covered in Section 10).',
      '<code>kubectl delete &lt;resource&gt; &lt;name&gt;</code> removes a resource; deleting a Deployment cascades automatically and removes its ReplicaSet and Pods too.',
    ],
    code: `# List resources
kubectl get nodes
kubectl get pods
kubectl get deployments
kubectl get replicasets
kubectl get services
kubectl get all

# Extra detail
kubectl get pods -o wide
# NAME                    READY   STATUS    RESTARTS   AGE   IP           NODE
# nginx-depl-6c9-4f2xk    1/1     Running   0          2m    172.17.0.5   minikube

kubectl get deployment nginx-depl -o yaml   # full manifest, including auto-generated status

# Deep-dive / debug a specific resource
kubectl describe pod nginx-depl-6c9-4f2xk
# Name:         nginx-depl-6c9-4f2xk
# ...
# Events:
#   Type    Reason     Age   From               Message
#   ----    ------     ----  ----               -------
#   Normal  Scheduled  2m    default-scheduler  Successfully assigned default/nginx-depl-6c9-4f2xk to minikube
#   Normal  Pulling    2m    kubelet            Pulling image "nginx"
#   Normal  Pulled     1m    kubelet            Successfully pulled image "nginx"
#   Normal  Created    1m    kubelet            Created container nginx
#   Normal  Started    1m    kubelet            Started container nginx

# Remove a resource (cascades: Deployment -> ReplicaSet -> Pods)
kubectl delete deployment nginx-depl`,
    codeLabel: 'terminal',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'get tells you WHAT state a resource is in; describe tells you WHY it got there. When a pod is stuck, the Events section at the bottom of describe\'s output is almost always where the real error message is hiding.',
      tone: 'accent',
    },
    quiz: {
      question: 'A pod has been stuck in <code>ContainerCreating</code> for five minutes. Which command will most likely reveal why?',
      options: [
        { label: 'kubectl describe pod <pod-name>', correct: true },
        { label: 'kubectl get pod <pod-name>', correct: false },
        { label: 'kubectl delete pod <pod-name>', correct: false },
        { label: 'kubectl create pod <pod-name>', correct: false },
      ],
      explanation: 'kubectl get only shows the status word you already have. kubectl describe adds the Events log, which shows exactly what step Kubernetes is stuck on — such as still pulling a large image, or failing to pull one at all. Deleting or trying to create a pod directly does not diagnose anything.',
    },
  },
  {
    id: '9.4',
    title: 'Creating & Debugging a Pod in Minikube',
    duration: '10 min',
    kind: 'demo',
    summary: [
      'With a working cluster and kubectl connected, it is time to create a first real workload. <code>kubectl create deployment nginx-depl --image=nginx</code> creates a Deployment named <code>nginx-depl</code> using the <code>nginx</code> image with no other configuration — everything else falls back to sensible defaults. Notice this creates a <strong>Deployment</strong>, not a bare Pod: even though a Pod is technically the smallest deployable unit in Kubernetes, <code>kubectl create</code> does not even offer a way to create one directly, because in practice you almost never work with Pods on their own. A Deployment is a management layer on top of Pods that can recreate them, scale them, and roll out updates to them — exactly the kind of control you want.',
      'Watching <code>kubectl get deployment</code>, <code>kubectl get pod</code>, and <code>kubectl get replicaset</code> right after creation reveals the full hierarchy Kubernetes builds automatically: the Deployment creates and owns a <strong>ReplicaSet</strong>, and the ReplicaSet creates and owns the actual <strong>Pod(s)</strong>. You manage the Deployment; Kubernetes manages everything below it. That is also where a pod\'s auto-generated name comes from: it follows the pattern <code>&lt;deployment-name&gt;-&lt;replicaset-hash&gt;-&lt;pod-hash&gt;</code>, so the name itself tells you which Deployment and ReplicaSet a pod belongs to. Right after creation the pod\'s status moves from <code>ContainerCreating</code> (the image is still being pulled) to <code>Running</code>.',
      '<code>kubectl edit deployment nginx-depl</code> opens the Deployment\'s live, cluster-generated manifest in your default text editor. Changing the image tag there — for example from <code>nginx</code> to <code>nginx:1.16</code> — and saving applies the change immediately: kubectl reports <code>deployment.apps/nginx-depl edited</code>. Watching <code>kubectl get pod</code> right after shows the old pod moving into <code>Terminating</code> while a brand-new pod, with a new replica-set hash in its name, starts up in its place. <code>kubectl get replicaset</code> confirms the same story from the other side: the old ReplicaSet\'s desired and current counts drop to zero, and a new ReplicaSet appears with the full count.',
      'The rule this demonstrates is one you should carry through the rest of this course: always create, edit, scale, and delete at the <strong>Deployment</strong> level, never the ReplicaSet or Pod directly. If you edit or delete a Pod by hand, its owning ReplicaSet will simply notice the mismatch and recreate or overwrite it, undoing your change. The Deployment is the one layer meant for you to touch.',
    ],
    keyPoints: [
      '<code>kubectl create deployment &lt;name&gt; --image=&lt;image&gt;</code> is the fastest way to get a first workload running, relying entirely on defaults.',
      'A Deployment automatically creates and owns a <strong>ReplicaSet</strong>, which in turn creates and owns the <strong>Pod(s)</strong> — you manage the Deployment, Kubernetes manages the rest.',
      'A pod\'s auto-generated name follows the pattern <code>&lt;deployment-name&gt;-&lt;replicaset-hash&gt;-&lt;pod-hash&gt;</code>.',
      '<code>kubectl edit deployment &lt;name&gt;</code> opens the live, cluster-generated manifest in your default editor; saving it applies the change immediately.',
      'Editing the image on a Deployment replaces the old pod with a new one automatically — never edit a Pod or ReplicaSet directly, since the Deployment will simply overwrite or recreate whatever you change there.',
    ],
    code: `kubectl get nodes
# NAME       STATUS   ROLES    AGE   VERSION
# minikube   Ready    master   10m   v1.17.0

kubectl get pod
# No resources found.

kubectl create deployment nginx-depl --image=nginx
# deployment.apps/nginx-depl created

kubectl get deployment
# NAME         READY   UP-TO-DATE   AVAILABLE   AGE
# nginx-depl   0/1     1            0           5s

kubectl get pod
# NAME                     READY   STATUS              RESTARTS   AGE
# nginx-depl-6c9-4f2xk     0/1     ContainerCreating   0          5s

kubectl get pod
# NAME                     READY   STATUS    RESTARTS   AGE
# nginx-depl-6c9-4f2xk     1/1     Running   0          15s

kubectl get replicaset
# NAME             DESIRED   CURRENT   READY   AGE
# nginx-depl-6c9   1         1         1       20s

# Edit the Deployment directly to bump the image version
kubectl edit deployment nginx-depl
# ... change "image: nginx" to "image: nginx:1.16", save and close ...
# deployment.apps/nginx-depl edited

kubectl get pod
# NAME                     READY   STATUS        RESTARTS   AGE
# nginx-depl-6c9-4f2xk     1/1     Terminating   0          3m
# nginx-depl-7d4-9plmx     1/1     Running       0          10s

kubectl get replicaset
# NAME             DESIRED   CURRENT   READY   AGE
# nginx-depl-6c9   0         0         0       3m
# nginx-depl-7d4   1         1         1       10s`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: 'Deployment -> ReplicaSet -> Pod is a strict one-way chain of ownership. Touch the top of the chain and everything below follows automatically; touch the bottom and the layer above just puts it back.',
      tone: 'green',
    },
    quiz: {
      question: 'You need to change the container image a running application uses. What is the correct way to do it?',
      options: [
        { label: 'Edit the Deployment (e.g. kubectl edit deployment <name>) and let Kubernetes recreate the Pod', correct: true },
        { label: 'Edit the Pod directly with kubectl edit pod', correct: false },
        { label: 'Edit the ReplicaSet directly with kubectl edit replicaset', correct: false },
        { label: 'Delete the Pod and manually create a new one with the new image', correct: false },
      ],
      explanation: 'The Deployment is the layer designed for you to configure. Editing a Pod or ReplicaSet directly gets silently overwritten, because the Deployment above them will notice the drift and reconcile it back to what the Deployment\'s own template says.',
    },
  },
  {
    id: '9.5',
    title: 'kubectl logs & exec: Debugging Pods (Bridging Back to Docker Debugging)',
    duration: '9 min',
    kind: 'demo',
    summary: [
      'Recall the Docker debugging lesson earlier in this course, where <code>docker logs &lt;container&gt;</code> printed whatever a container had written to stdout/stderr, and <code>docker exec -it &lt;container&gt; /bin/bash</code> dropped you into an interactive shell running inside that container for closer inspection. <code>kubectl logs</code> and <code>kubectl exec</code> do exactly the same two jobs, just one abstraction layer higher: pointed at a <strong>Pod</strong> (specifically, at a container running inside that pod) instead of a raw Docker container. If you already know when and why to reach for those two Docker commands, you already know when and why to reach for their kubectl equivalents.',
      'Creating a MongoDB deployment with <code>kubectl create deployment mongo-depl --image=mongo</code> makes this concrete. Right after creation the pod sits in <code>ContainerCreating</code> while the image downloads, and running <code>kubectl logs</code> against it at that point returns an error, not empty output — Kubernetes is telling you plainly that the container has not started yet, so there is nothing to log. <code>kubectl describe pod</code> confirms this by showing a <code>Pulling</code> event still in progress. Once the pod reaches <code>Running</code>, the exact same <code>kubectl logs</code> command now prints MongoDB\'s real startup log lines — this is the identical debugging move as <code>docker logs</code>, just against a pod name instead of a container ID.',
      '<code>kubectl exec -it mongo-depl-&lt;hash&gt; -- /bin/bash</code> mirrors <code>docker exec -it &lt;container&gt; /bin/bash</code> just as directly: it opens an interactive terminal inside the running container, landing you as the root user inside that container\'s own, completely separate filesystem. From there you can browse directories, check a configuration file, or print environment variables to confirm they were injected correctly — exactly the troubleshooting moves you already practiced with Docker, now running inside a Kubernetes-managed container. Type <code>exit</code> to leave the shell and return to your own terminal.',
      'One difference worth flagging now, because it will matter the moment a pod runs more than one container: both <code>kubectl logs</code> and <code>kubectl exec</code> need a <code>-c &lt;container-name&gt;</code> flag to say which container inside the pod you mean, since a single pod can host several. Docker never has this ambiguity, because a Docker container is always the direct debugging target. Finally, cleaning up here works exactly as it did in the last lesson: <code>kubectl delete deployment mongo-depl</code> removes the Deployment and cascades down through its ReplicaSet and Pod automatically.',
    ],
    keyPoints: [
      '<code>kubectl logs &lt;pod-name&gt;</code> is the direct kubectl equivalent of <code>docker logs &lt;container&gt;</code> from the earlier Docker debugging lesson — both print whatever the application wrote to stdout/stderr.',
      '<code>kubectl exec -it &lt;pod-name&gt; -- &lt;command&gt;</code> mirrors <code>docker exec -it &lt;container&gt; &lt;command&gt;</code> — both drop you into a live shell inside the running container.',
      'If a container has not started yet, <code>kubectl logs</code> returns an error rather than empty output — check <code>kubectl describe pod</code> first to see what it is waiting on.',
      'When a pod runs <strong>multiple containers</strong>, <code>kubectl logs</code>/<code>exec</code> need a <code>-c &lt;container-name&gt;</code> flag to say which one you mean — an ambiguity Docker never has.',
      'Deleting the owning Deployment (<code>kubectl delete deployment &lt;name&gt;</code>) is the correct way to remove a pod created this way — it cascades through the ReplicaSet automatically.',
    ],
    code: `kubectl create deployment mongo-depl --image=mongo
# deployment.apps/mongo-depl created

kubectl get pod
# NAME                          READY   STATUS              RESTARTS   AGE
# mongo-depl-7d4f8b9c8f-xk2pl   0/1     ContainerCreating   0          4s

kubectl logs mongo-depl-7d4f8b9c8f-xk2pl
# Error from server (BadRequest): container "mongo" in pod "mongo-depl-7d4f8b9c8f-xk2pl" is waiting to start: ContainerCreating

kubectl describe pod mongo-depl-7d4f8b9c8f-xk2pl
# ...
# Events:
#   Normal  Pulling  10s   kubelet  Pulling image "mongo"

kubectl get pod
# NAME                          READY   STATUS    RESTARTS   AGE
# mongo-depl-7d4f8b9c8f-xk2pl   1/1     Running   0          45s

# Same job as "docker logs <container>", one layer up:
kubectl logs mongo-depl-7d4f8b9c8f-xk2pl
# {"t":{"$date":"2026-01-14T10:15:03.112Z"},"s":"I","c":"NETWORK","msg":"Waiting for connections","attr":{"port":27017}}

# Same job as "docker exec -it <container> /bin/bash", one layer up:
kubectl exec -it mongo-depl-7d4f8b9c8f-xk2pl -- /bin/bash
# root@mongo-depl-7d4f8b9c8f-xk2pl:/#   <- interactive shell inside the container
# root@mongo-depl-7d4f8b9c8f-xk2pl:/# exit

# Clean up: deleting the Deployment cascades to its ReplicaSet and Pod
kubectl delete deployment mongo-depl
# deployment.apps "mongo-depl" deleted`,
    codeLabel: 'terminal',
    note: {
      label: 'KEY INSIGHT',
      text: 'Everything you already know from docker logs and docker exec transfers directly. Kubernetes just adds one more addressing layer, the pod name, on top of the same underlying container debugging model.',
      tone: 'green',
    },
    quiz: {
      question: 'You used docker exec -it <container> /bin/bash constantly to debug containers earlier in this course. What is the direct kubectl equivalent for a pod running a single container?',
      options: [
        { label: 'kubectl exec -it <pod-name> -- /bin/bash', correct: true },
        { label: 'kubectl logs -it <pod-name>', correct: false },
        { label: 'kubectl describe -it <pod-name>', correct: false },
        { label: 'kubectl attach <pod-name> --bash', correct: false },
      ],
      explanation: 'kubectl exec -it <pod-name> -- <command> is the pod-level equivalent of docker exec -it <container> <command>. kubectl logs only streams output, describe only shows configuration and events, and attach connects to the container\'s main process rather than opening a new shell.',
    },
  },
]
