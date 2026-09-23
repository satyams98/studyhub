export default [
  {
    id: '2.1',
    title: 'Job, JobInstance, JobExecution, and JobParameters',
    duration: '8 min',
    kind: 'concept',
    summary: [
      'Spring Batch has a strict four-level hierarchy that governs every execution. A <code>Job</code> is the top-level blueprint — it defines the steps and their flow, but it is not executable by itself. A <code>JobInstance</code> is a logical run of that job for a specific set of <code>JobParameters</code>. Think of the <code>Job</code> as a class and the <code>JobInstance</code> as an object instantiated with constructor arguments. A <code>JobExecution</code> is a single attempt to execute a <code>JobInstance</code>. If a job fails and you restart it with the same parameters, you get a new <code>JobExecution</code> for the same <code>JobInstance</code> — this is the mechanism that makes restartability possible.',
      '<code>JobParameters</code> are the key-value pairs that identify a logical run. If you run the same <code>Job</code> with identical parameters, Spring Batch looks up the existing <code>JobInstance</code>. If that instance already completed successfully, the framework throws <code>JobInstanceAlreadyCompleteException</code> to prevent accidental duplicate processing. This is a safety feature, not a bug: in financial reconciliation, running the same nightly job twice with the same date parameter would double-count settlements. To allow repeated scheduled runs, you add a <code>JobParametersIncrementer</code> — typically <code>RunIdIncrementer</code> — which appends a unique run ID to the parameters, creating a fresh <code>JobInstance</code> every time.',
      'Each <code>JobExecution</code> creates one <code>StepExecution</code> per step in the job. The <code>StepExecution</code> tracks read count, write count, commit count, skip count, and the <code>ExecutionContext</code> — a persistent key-value map that survives restarts. For a single-threaded job, there is one <code>StepExecution</code>. For a partitioned job, there is one per partition. All of this metadata lives in the <code>JobRepository</code> tables: <code>BATCH_JOB_INSTANCE</code>, <code>BATCH_JOB_EXECUTION</code>, <code>BATCH_JOB_PARAMS</code>, and <code>BATCH_STEP_EXECUTION</code>.',
      'Understanding this hierarchy is essential because it explains every operational question you will face: Why did my restart fail? (The <code>JobInstance</code> was already complete.) Why is my step starting from line 5000? (The previous <code>StepExecution</code> stored the line number in its <code>ExecutionContext</code>.) How do I run the same job every hour? (Use an incrementer so each hour creates a distinct <code>JobInstance</code>.)',
    ],
    keyPoints: [
      'A <code>Job</code> is the blueprint; a <code>JobInstance</code> is a logical run identified by <code>JobParameters</code>; a <code>JobExecution</code> is one physical attempt.',
      'Identical parameters + same job name = same <code>JobInstance</code>. A successful rerun throws <code>JobInstanceAlreadyCompleteException</code>.',
      'A <code>JobParametersIncrementer</code> (e.g., <code>RunIdIncrementer</code>) creates a fresh <code>JobInstance</code> for each scheduled run.',
      'Each <code>JobExecution</code> produces one <code>StepExecution</code> per step, tracking counts and persistent state.',
      'The <code>ExecutionContext</code> inside a <code>StepExecution</code> is how Spring Batch remembers where it was after a crash.',
    ],
    code: `package com.example.reconciliation.batch;

import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.LocalDate;

@Configuration
public class JobHierarchyDemoConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public JobHierarchyDemoConfig(JobRepository jobRepository,
                                  PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job parameterAwareJob() {
        return new JobBuilder("parameterAwareJob", jobRepository)
                .start(new StepBuilder("logParamsStep", jobRepository)
                        .tasklet((contribution, chunkContext) -> {
                            JobParameters params = chunkContext.getStepContext()
                                    .getStepExecution()
                                    .getJobParameters();
                            System.out.println("Processing date: " + params.getLocalDate("processDate"));
                            return RepeatStatus.FINISHED;
                        }, transactionManager)
                        .build())
                .incrementer(new org.springframework.batch.core.launch.support.RunIdIncrementer())
                .build();
    }

    // Example of how to launch programmatically with parameters
    public static void runWithParameters(JobLauncher launcher, Job job) throws Exception {
        JobParameters params = new JobParametersBuilder()
                .addLocalDate("processDate", LocalDate.now())
                .toJobParameters();
        launcher.run(job, params);
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'The JobRepository is not just audit logging — it is the state machine that makes restartability possible. Every JobExecution row is a snapshot of a running or completed attempt.',
      tone: 'accent',
    },
    quiz: {
      question: 'You trigger a job named <code>reconciliationJob</code> with parameters <code>{processDate=2026-07-16}</code>. It completes successfully. You trigger it again with the exact same parameters. What happens?',
      options: [
        { label: 'Spring Batch creates a new JobExecution and reprocesses all data', correct: false },
        { label: 'Spring Batch throws JobInstanceAlreadyCompleteException because the JobInstance for those parameters is already complete', correct: true },
        { label: 'Spring Batch silently skips the job and returns the previous JobExecution', correct: false },
        { label: 'Spring Batch overwrites the previous JobExecution with the new one', correct: false },
      ],
      explanation: 'This is the core safety guarantee of the JobInstance model. Identical parameters map to the same JobInstance, and a completed JobInstance cannot be re-executed. To run the same logical job repeatedly (e.g., nightly), you must use a JobParametersIncrementer to vary the parameters per run, creating a distinct JobInstance each time.',
    },
  },
  {
    id: '2.2',
    title: 'Step and StepExecution',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'A <code>Step</code> is the atomic unit of work inside a <code>Job</code>. Every job is composed of one or more steps, and each step is either chunk-oriented (read-process-write loop) or tasklet-oriented (single-shot operation). The <code>Step</code> defines the configuration — the reader, processor, writer, chunk size, and transaction manager — but it does not execute itself. Execution is represented by <code>StepExecution</code>, which is created when the job launcher starts a <code>JobExecution</code>.',
      'There is exactly one <code>StepExecution</code> per step per <code>JobExecution</code>. If a job has three steps and is run once, there are three <code>StepExecution</code> rows in <code>BATCH_STEP_EXECUTION</code>. If the job is restarted (same <code>JobInstance</code>, new <code>JobExecution</code>), a fresh set of <code>StepExecution</code> rows is created. Each <code>StepExecution</code> tracks granular metrics: <code>read_count</code>, <code>write_count</code>, <code>commit_count</code>, <code>rollback_count</code>, <code>skip_count</code>, and timing fields <code>start_time</code> and <code>end_time</code>. These are not just for dashboards — they are how Spring Batch decides whether a step can be skipped on restart (if it already completed, it may be skipped depending on restart policy).',
      'In partitioned execution (see 11.4), the master step has one <code>StepExecution</code>, and each slave partition also has its own <code>StepExecution</code>. This means a single partitioned step can produce dozens of rows in <code>BATCH_STEP_EXECUTION</code>, all linked to the same <code>JobExecution</code>. The <code>StepExecution</code> also owns an <code>ExecutionContext</code> (see 2.3), which is the persistent key-value store for that step\'s state. For example, a <code>FlatFileItemReader</code> stores the current line number in the step\'s <code>ExecutionContext</code> after each chunk commit, so a restart knows exactly where to resume.',
      'The relationship between <code>Step</code> and <code>StepExecution</code> is the same as between <code>Job</code> and <code>JobExecution</code>: the former is the definition, the latter is the runtime instance. When you debug a failed batch job, you inspect the <code>StepExecution</code> row to see which chunk failed, how many items were skipped, and what state was persisted in the <code>ExecutionContext</code>.',
    ],
    keyPoints: [
      'A <code>Step</code> is the atomic unit of work; a <code>StepExecution</code> is its runtime instance.',
      'One <code>StepExecution</code> per step per <code>JobExecution</code> — a three-step job produces three rows.',
      '<code>StepExecution</code> tracks read/write/commit/rollback/skip counts and timing.',
      'Partitioned steps produce one <code>StepExecution</code> per partition plus one for the master step.',
      'The <code>ExecutionContext</code> attached to a <code>StepExecution</code> is how restartable state is persisted.',
    ],
    code: `package com.example.reconciliation.batch;

import com.example.reconciliation.domain.ReconciledTransaction;
import com.example.reconciliation.domain.TransactionRecord;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemReader;
import org.springframework.batch.item.ItemWriter;
import org.springframework.batch.item.file.FlatFileItemReader;
import org.springframework.batch.item.file.builder.FlatFileItemReaderBuilder;
import org.springframework.batch.item.file.mapping.RecordFieldSetMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.FileSystemResource;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class StepExecutionDemoConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public StepExecutionDemoConfig(JobRepository jobRepository,
                                   PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job multiStepJob() {
        return new JobBuilder("multiStepJob", jobRepository)
                .start(validateInputStep())
                .next(reconcileStep())
                .build();
    }

    @Bean
    public Step validateInputStep() {
        return new StepBuilder("validateInputStep", jobRepository)
                .<TransactionRecord, TransactionRecord>chunk(100, transactionManager)
                .reader(csvReader())
                .processor(validationProcessor())
                .writer(passThroughWriter())
                .build();
    }

    @Bean
    public Step reconcileStep() {
        return new StepBuilder("reconcileStep", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(100, transactionManager)
                .reader(csvReader())
                .processor(reconciliationProcessor())
                .writer(reconciledWriter())
                .build();
    }

    @Bean
    public FlatFileItemReader<TransactionRecord> csvReader() {
        return new FlatFileItemReaderBuilder<TransactionRecord>()
                .name("csvReader")
                .resource(new FileSystemResource("data/transactions.csv"))
                .linesToSkip(1)
                .delimited()
                .names("transactionId", "accountId", "amount", "currency", "transactionDate", "status")
                .fieldSetMapper(new RecordFieldSetMapper<>(TransactionRecord.class))
                .build();
    }

    @Bean
    public ItemProcessor<TransactionRecord, TransactionRecord> validationProcessor() {
        return record -> {
            if (record.amount() == null || record.transactionId() == null) {
                throw new IllegalArgumentException("Invalid record");
            }
            return record;
        };
    }

    @Bean
    public ItemProcessor<TransactionRecord, ReconciledTransaction> reconciliationProcessor() {
        return record -> new ReconciledTransaction(
                record.transactionId(),
                record.accountId(),
                record.amount(),
                "PENDING",
                "Awaiting settlement"
        );
    }

    @Bean
    public ItemWriter<TransactionRecord> passThroughWriter() {
        return chunk -> chunk.forEach(tx -> System.out.println("Valid: " + tx.transactionId()));
    }

    @Bean
    public ItemWriter<ReconciledTransaction> reconciledWriter() {
        return chunk -> chunk.forEach(tx -> System.out.println("Reconciled: " + tx.transactionId()));
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'When a job fails, you inspect BATCH_STEP_EXECUTION to find which step failed, at what commit count, and what state was stored. The StepExecution is your forensic record.',
      tone: 'green',
    },
    quiz: {
      question: 'A job named <code>reconciliationJob</code> contains three steps: <code>validateStep</code>, <code>enrichStep</code>, and <code>writeStep</code>. It is launched once and fails during <code>enrichStep</code>. You restart the same <code>JobInstance</code>. How many <code>StepExecution</code> rows exist in <code>BATCH_STEP_EXECUTION</code> after the restart completes?',
      options: [
        { label: '3 — one per step, shared across all executions', correct: false },
        { label: '6 — three from the first JobExecution and three from the restart JobExecution', correct: true },
        { label: '4 — three from the first run plus one new StepExecution for the failed enrichStep', correct: false },
        { label: '2 — only the failed enrichStep and writeStep get new StepExecutions on restart', correct: false },
      ],
      explanation: 'Each JobExecution creates its own set of StepExecutions, one per step. The first failed run created 3 StepExecution rows. The restart creates a new JobExecution, which also creates 3 new StepExecution rows. Spring Batch may skip already-completed steps on restart depending on configuration, but the rows are still created. Total = 6.',
    },
  },
  {
    id: '2.3',
    title: 'ExecutionContext — Job-Level vs Step-Level',
    duration: '7 min',
    kind: 'concept',
    summary: [
      'The <code>ExecutionContext</code> is a persistent <code>Map&lt;String, Object&gt;</code> that survives JVM restarts. It is how Spring Batch remembers state. There are two scopes: job-level and step-level. The job-level <code>ExecutionContext</code> is attached to the <code>JobExecution</code> and is shared across all steps in that job run. The step-level <code>ExecutionContext</code> is attached to the <code>StepExecution</code> and is private to that step. Both are persisted to the <code>JobRepository</code> after each chunk commit (for step-level) and after each step completion (for job-level).',
      'The step-level <code>ExecutionContext</code> is what makes readers restart-safe. <code>FlatFileItemReader</code> automatically stores the current line number under the key <code>FlatFileItemReader.read.count</code> in the step\'s <code>ExecutionContext</code> after every chunk commit. When the job restarts, the reader retrieves this value and skips to that line. <code>JdbcCursorItemReader</code> does not have a natural row number, so if you need restartability with JDBC cursors, you must manage the offset yourself — for example, by storing the last-read <code>transactionId</code> in the <code>ExecutionContext</code> and using it in a <code>WHERE transactionId &gt; :lastId</code> clause.',
      'The job-level <code>ExecutionContext</code> is useful for cross-step communication. For example, <code>validateStep</code> might count total invalid records and store <code>validation.invalidCount</code> in the job context. <code>writeStep</code> can then read this value and include it in a summary report. However, because the job context is only persisted at step boundaries (not chunk boundaries), it is not suitable for high-frequency updates — use the step context for that. Also, anything stored in the <code>ExecutionContext</code> must be <code>Serializable</code>; attempting to store a non-serializable object (like a <code>BufferedReader</code> or a database connection) will fail at persistence time with a serialization exception.',
      'Custom components can participate in this mechanism by implementing <code>ItemStream</code>. The interface has three methods: <code>open(ExecutionContext)</code> (called before the first read to restore state), <code>update(ExecutionContext)</code> (called after each chunk commit to save state), and <code>close()</code> (called when the step ends, successful or not). If you write a custom <code>ItemReader</code> that reads from an external API or a NoSQL store, implementing <code>ItemStream</code> is how you make it restart-safe.',
    ],
    keyPoints: [
      '<code>ExecutionContext</code> is a persistent Map that survives JVM restarts via the JobRepository.',
      'Job-level context is shared across steps; step-level context is private to one step.',
      'Built-in readers like <code>FlatFileItemReader</code> automatically store position in the step context.',
      'Custom restartable components must implement <code>ItemStream</code> to participate in open/update/close lifecycle.',
      'All values stored in <code>ExecutionContext</code> must be <code>Serializable</code>.',
    ],
    code: `package com.example.reconciliation.batch;

import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.item.ExecutionContext;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class ExecutionContextDemoConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public ExecutionContextDemoConfig(JobRepository jobRepository,
                                      PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job contextSharingJob() {
        return new JobBuilder("contextSharingJob", jobRepository)
                .start(countRecordsStep())
                .next(reportSummaryStep())
                .build();
    }

    @Bean
    public Step countRecordsStep() {
        return new StepBuilder("countRecordsStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    StepExecution stepExecution = chunkContext.getStepContext().getStepExecution();
                    ExecutionContext stepContext = stepExecution.getExecutionContext();
                    ExecutionContext jobContext = stepExecution.getJobExecution().getExecutionContext();

                    stepContext.putString("step.lastProcessedId", "TXN-99999");
                    stepContext.putLong("step.processedCount", 15000L);

                    jobContext.putLong("job.totalRecords", 15000L);
                    jobContext.putString("job.runDate", "2026-07-16");

                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }

    @Bean
    public Step reportSummaryStep() {
        return new StepBuilder("reportSummaryStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    StepExecution stepExecution = chunkContext.getStepContext().getStepExecution();
                    ExecutionContext jobContext = stepExecution.getJobExecution().getExecutionContext();

                    Long total = jobContext.getLong("job.totalRecords");
                    String date = jobContext.getString("job.runDate");

                    System.out.printf("Report for %s: %d records processed%n", date, total);
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WARNING',
      text: 'Never store non-serializable objects like database connections, InputStreams, or Spring proxies in ExecutionContext. The framework attempts to serialize it to the JobRepository after every chunk commit, and a serialization failure will crash the step.',
      tone: 'accent',
    },
    quiz: {
      question: 'You write a custom <code>ItemReader</code> that fetches transactions from a REST API using an offset parameter. You want the reader to resume from the correct offset after a JVM crash. What is the minimum interface your reader must implement?',
      options: [
        { label: 'ItemReader&lt;TransactionRecord&gt; only', correct: false },
        { label: 'ItemReader&lt;TransactionRecord&gt; and ItemStream', correct: true },
        { label: 'ItemReader&lt;TransactionRecord&gt; and StepExecutionListener', correct: false },
        { label: 'ItemReader&lt;TransactionRecord&gt; and JobExecutionListener', correct: false },
      ],
      explanation: 'ItemReader alone provides the read() method but no lifecycle hooks for persistence. ItemStream provides open(ExecutionContext), update(ExecutionContext), and close() — the exact hooks needed to save the offset after each chunk and restore it on restart. StepExecutionListener and JobExecutionListener are useful for other purposes but do not participate in the restart-state persistence mechanism.',
    },
  },
  {
    id: '2.4',
    title: 'JobParametersIncrementer — Fresh Instance vs Restart',
    duration: '6 min',
    kind: 'concept',
    summary: [
      'The <code>JobParametersIncrementer</code> solves the scheduling problem: how do you run the same job every night without hitting <code>JobInstanceAlreadyCompleteException</code>? Remember from 2.1 that identical parameters map to the same <code>JobInstance</code>, and a completed <code>JobInstance</code> cannot be re-executed. The incrementer is a strategy that mutates the parameters before the job launches, ensuring each scheduled invocation creates a distinct <code>JobInstance</code>.',
      'The canonical implementation is <code>RunIdIncrementer</code>, which adds a <code>run.id</code> parameter with a monotonically increasing long value. When the scheduler triggers the job with <code>{processDate=2026-07-16}</code>, the incrementer transforms this to <code>{processDate=2026-07-16, run.id=47}</code>. Because the parameters are now different, Spring Batch creates a new <code>JobInstance</code>. This is the standard pattern for cron-triggered jobs. You attach the incrementer to the <code>JobBuilder</code> with <code>.incrementer(new RunIdIncrementer())</code>.',
      'A restart is different from a fresh scheduled run. When a job fails and you want to resume from where it left off, you must use the <strong>same</strong> parameters — including the same <code>run.id</code> — so that Spring Batch resolves to the same <code>JobInstance</code> and creates a new <code>JobExecution</code> for it. If you accidentally increment the run ID on restart, you create a brand-new <code>JobInstance</code> that starts from the beginning, potentially double-processing data. This is why restart APIs (see 13.1) typically bypass the incrementer or explicitly use the previous parameters.',
      'You can also write custom incrementers. For example, a <code>TimestampIncrementer</code> that adds <code>run.timestamp</code>, or a <code>DateIncrementer</code> that adds the current date if not already present. The rule is simple: the incrementer must produce parameters that are different from every previous run, but deterministic enough that a restart API can find the right instance. <code>RunIdIncrementer</code> is deterministic because it reads the last run ID from the <code>JobRepository</code>; a random UUID would not be restartable because you could not reconstruct it.',
    ],
    keyPoints: [
      '<code>JobParametersIncrementer</code> ensures each scheduled run gets a distinct <code>JobInstance</code>.',
      '<code>RunIdIncrementer</code> adds a monotonic <code>run.id</code> parameter — the standard pattern for cron jobs.',
      'Restarts must use the same parameters (including <code>run.id</code>) to resolve to the existing <code>JobInstance</code>.',
      'Incrementing on restart accidentally creates a new <code>JobInstance</code> that starts from scratch.',
      'Custom incrementers must produce unique but deterministic parameters; random UUIDs are not restartable.',
    ],
    code: `package com.example.reconciliation.batch;

import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.JobParametersIncrementer;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Configuration
public class IncrementerDemoConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public IncrementerDemoConfig(JobRepository jobRepository,
                                 PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job scheduledReconciliationJob() {
        return new JobBuilder("scheduledReconciliationJob", jobRepository)
                .start(new StepBuilder("nightlyStep", jobRepository)
                        .tasklet((contribution, chunkContext) -> {
                            JobParameters params = chunkContext.getStepContext()
                                    .getStepExecution().getJobParameters();
                            System.out.println("Run ID: " + params.getLong("run.id"));
                            System.out.println("Process date: " + params.getString("processDate"));
                            return RepeatStatus.FINISHED;
                        }, transactionManager)
                        .build())
                .incrementer(new org.springframework.batch.core.launch.support.RunIdIncrementer())
                .build();
    }

    @Bean
    public JobParametersIncrementer dateIncrementer() {
        return parameters -> {
            JobParametersBuilder builder = new JobParametersBuilder(parameters);
            if (!parameters.getParameters().containsKey("processDate")) {
                builder.addString("processDate",
                        LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE));
            }
            return builder.toJobParameters();
        };
    }

    // Correct way to restart: use the SAME parameters as the failed execution
    public static void restartJob(JobLauncher launcher, Job job, JobParameters failedParams) throws Exception {
        launcher.run(job, failedParams);
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'DECISION POINT',
      text: 'Use RunIdIncrementer for scheduled jobs. For restarts, always retrieve the original JobParameters from the failed JobExecution and relaunch with those exact parameters.',
      tone: 'accent',
    },
    quiz: {
      question: 'Your scheduler triggers <code>reconciliationJob</code> every night at 02:00 with parameters <code>{processDate=2026-07-16}</code>. The job has a <code>RunIdIncrementer</code>. The job fails at 02:45. At 03:00, an operator attempts a restart using the same scheduled parameters <code>{processDate=2026-07-16}</code> but the incrementer adds a new <code>run.id</code>. What happens?',
      options: [
        { label: 'The job restarts from the last committed chunk of the failed run', correct: false },
        { label: 'A new JobInstance is created and the job starts from the beginning, potentially double-processing data', correct: true },
        { label: 'Spring Batch detects the mismatch and throws an exception', correct: false },
        { label: 'The new JobInstance is created but Spring Batch automatically skips already-processed records', correct: false },
      ],
      explanation: 'Because the incremented run.id produces different parameters, Spring Batch resolves to a new JobInstance. It has no knowledge of the previous failed instance\'s ExecutionContext or progress. The job starts from line 1 (or row 1) of the input, and any data already written by the failed run will be reprocessed. There is no automatic deduplication — you must use the exact same parameters (including the original run.id) to restart the same JobInstance.',
    },
  },
  {
    id: '2.5',
    title: 'BatchStatus vs ExitStatus',
    duration: '6 min',
    kind: 'concept',
    summary: [
      '<code>BatchStatus</code> and <code>ExitStatus</code> are two different concepts that are often confused. <code>BatchStatus</code> is an enum representing the JVM-level state of the execution: <code>STARTING</code>, <code>STARTED</code>, <code>COMPLETED</code>, <code>FAILED</code>, <code>STOPPED</code>, <code>ABANDONED</code>, <code>UNKNOWN</code>. It is managed by the framework itself and reflects what actually happened to the JVM process. You should not set <code>BatchStatus</code> manually in normal code — it is updated by the framework as the job progresses.',
      '<code>ExitStatus</code> is a simple string — literally a <code>String</code> inside an <code>ExitStatus</code> wrapper — that is used for flow decisions. It is what drives the <code>.on(status).to(step)</code> transitions in job configuration (see 12.1). By default, a successful step returns <code>ExitStatus.COMPLETED</code> (the string <code>"COMPLETED"</code>), and a failed step returns <code>ExitStatus.FAILED</code> (the string <code>"FAILED"</code>). But you can customize it. For example, a validation step might return <code>ExitStatus("VALIDATION_WARNINGS")</code> if 5% of records failed validation but the step itself did not throw an exception. The job flow can then branch: <code>.on("VALIDATION_WARNINGS").to(reviewStep)</code> instead of proceeding to the normal write step.',
      'The two can diverge. A step might have <code>BatchStatus.COMPLETED</code> (it ran to the end without an exception) but a custom <code>ExitStatus("PARTIAL_MATCH")</code> that routes to a manual-review step. Conversely, a step might have <code>BatchStatus.FAILED</code> (an exception was thrown) but the default <code>ExitStatus</code> is also <code>"FAILED"</code>. The key distinction: <code>BatchStatus</code> is for the framework\'s state machine and operational monitoring; <code>ExitStatus</code> is for business-level flow control. When you query the <code>JobRepository</code> to see if a job finished, you look at <code>BatchStatus</code>. When you write conditional job flows, you look at <code>ExitStatus</code>.',
      'You customize <code>ExitStatus</code> by implementing a <code>StepExecutionListener</code> and overriding <code>afterStep</code>. Inside that method, you inspect the <code>StepExecution</code> metrics and return a custom <code>ExitStatus</code>. This is the standard pattern for business-driven branching, as opposed to exception-driven branching. For example, a reconciliation step that finds 0% mismatches might return <code>"NO_MISMATCH"</code> and skip the alert step, while finding &gt;10% mismatches returns <code>"HIGH_MISMATCH"</code> and routes to an escalation step.',
    ],
    keyPoints: [
      '<code>BatchStatus</code> is an enum representing the JVM execution state (STARTED, COMPLETED, FAILED, etc.).',
      '<code>ExitStatus</code> is a string used for flow decisions in <code>.on(status).to(step)</code> transitions.',
      'A step can have <code>BatchStatus.COMPLETED</code> but a custom <code>ExitStatus</code> for business branching.',
      'Customize <code>ExitStatus</code> in a <code>StepExecutionListener.afterStep()</code> based on step metrics.',
      'Do not manually set <code>BatchStatus</code> — it is framework-managed.',
    ],
    code: `package com.example.reconciliation.batch;

import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.StepExecutionListener;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class ExitStatusDemoConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public ExitStatusDemoConfig(JobRepository jobRepository,
                                PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job conditionalReconciliationJob() {
        return new JobBuilder("conditionalReconciliationJob", jobRepository)
                .start(reconcileStep())
                .on("HIGH_MISMATCH").to(escalationStep())
                .from(reconcileStep())
                .on("NO_MISMATCH").to(skipAlertStep())
                .from(reconcileStep())
                .on("*").to(standardAlertStep())
                .end()
                .build();
    }

    @Bean
    public Step reconcileStep() {
        return new StepBuilder("reconcileStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    double mismatchRatio = 0.15;
                    chunkContext.getStepContext()
                            .getStepExecution()
                            .getExecutionContext()
                            .putDouble("mismatchRatio", mismatchRatio);
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .listener(mismatchRatioListener())
                .build();
    }

    @Bean
    public StepExecutionListener mismatchRatioListener() {
        return new StepExecutionListener() {
            @Override
            public void beforeStep(StepExecution stepExecution) {}

            @Override
            public ExitStatus afterStep(StepExecution stepExecution) {
                double ratio = stepExecution.getExecutionContext()
                        .getDouble("mismatchRatio", 0.0);

                if (ratio == 0.0) {
                    return new ExitStatus("NO_MISMATCH");
                } else if (ratio > 0.10) {
                    return new ExitStatus("HIGH_MISMATCH");
                }
                return ExitStatus.COMPLETED;
            }
        };
    }

    @Bean
    public Step escalationStep() {
        return new StepBuilder("escalationStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    System.out.println("ESCALATION: High mismatch rate detected");
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }

    @Bean
    public Step skipAlertStep() {
        return new StepBuilder("skipAlertStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    System.out.println("No mismatches — skipping alert");
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }

    @Bean
    public Step standardAlertStep() {
        return new StepBuilder("standardAlertStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    System.out.println("Standard alert sent");
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'KEY INSIGHT',
      text: 'BatchStatus tells you what the JVM did. ExitStatus tells the job flow what to do next. They are decoupled so that a step can complete successfully but still trigger a non-standard path.',
      tone: 'accent',
    },
    quiz: {
      question: 'A step completes all its reads and writes without throwing any exceptions, but a <code>StepExecutionListener</code> sets <code>ExitStatus</code> to <code>"REVIEW_REQUIRED"</code>. What is the <code>BatchStatus</code> of the <code>StepExecution</code>?',
      options: [
        { label: 'FAILED', correct: false },
        { label: 'COMPLETED', correct: true },
        { label: 'UNKNOWN', correct: false },
        { label: 'STOPPED', correct: false },
      ],
      explanation: 'Because no exception was thrown and the step ran to completion, the framework sets BatchStatus.COMPLETED. The custom ExitStatus is independent — it is used for flow routing but does not change the JVM-level execution state. This is the core distinction: BatchStatus reflects what happened to the process; ExitStatus is a business signal for conditional transitions.',
    },
  },
]
