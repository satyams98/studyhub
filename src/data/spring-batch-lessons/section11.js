export default [
  {
    id: '11.1',
    title: "Architecture 1: Single-Threaded — Model & When It's Right",
    duration: '12 min',
    kind: 'concept',
    summary: [
      `Before you scale, you must understand the baseline. A single-threaded Spring Batch job is the default architecture and a deliberate production choice — not a placeholder. Understanding it is the prerequisite for every scaling decision that follows.`,
    ],
    topics: [
      {
        title: 'The Baseline Model',
        body: [
          `A single-threaded <code>Step</code> executes its read-process-write loop on one thread inside one JVM. There is no <code>TaskExecutor</code>, no <code>Partitioner</code>, and no message broker. The <code>ItemReader</code> pulls records sequentially, the <code>ItemProcessor</code> transforms each one, and the <code>ItemWriter</code> commits them in chunk-sized transactions. The <code>JobRepository</code> tracks execution state, but all of it lives in one process.`,
          `This is not a naive placeholder — it is a deliberate, valid production choice for moderate-volume, order-sensitive workloads. Single-threaded execution preserves record order, avoids all distributed-system failure modes, and keeps the operational surface minimal. For a nightly reconciliation job processing 50,000 transactions in a four-hour batch window, adding partitioning is premature optimization: it introduces complexity without solving a real problem.`,
        ],
        diagram: `<div class="diagram-caption">Architecture: Single-Threaded Step</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">One Thread · One JVM · No TaskExecutor · No Partitioner</div><div class="dg-pipe"><div class="dg-box dg-box--dim"><div class="dg-box-title">Input Source</div><div class="dg-box-sub">CSV / DB / Stream</div></div><div class="dg-arrow"><span>→</span><small>sequential</small></div><div class="dg-box dg-box--accent"><div class="dg-box-title">ItemReader</div><div class="dg-box-sub">read() one item</div></div><div class="dg-arrow"><span>→</span><small>1 item</small></div><div class="dg-box"><div class="dg-box-title">ItemProcessor</div><div class="dg-box-sub">transform()</div></div><div class="dg-arrow"><span>→</span><small>chunk[N]</small></div><div class="dg-box"><div class="dg-box-title">ItemWriter</div><div class="dg-box-sub">commit tx</div></div><div class="dg-arrow"><span>→</span><small>write</small></div><div class="dg-box dg-box--dim"><div class="dg-box-title">Output</div><div class="dg-box-sub">DB / File</div></div></div></div><div class="dg-repo"><div class="dg-box dg-box--green"><div class="dg-box-title">JobRepository</div><div class="dg-box-sub">tracks per execution: read_count · write_count · commit_count · status · ExecutionContext (restart position)</div></div></div></div>`,
      },
      {
        title: 'When the Architecture Stops Fitting',
        body: [
          `The critical skill is knowing <em>when</em> the architecture stops fitting. The warning sign is not total record count — it is a <em>falling chunk-commit rate</em>. As data volume grows, the time to process one chunk stays roughly constant, so the number of chunks per minute drops proportionally. If your SLA requires the job to finish by 06:00 and at 05:30 it is only 40% done, the single-threaded model has hit its ceiling.`,
          `The bottleneck is not a bigger VM; it is that the step's throughput is bound by one CPU core and one sequential I/O stream. A practical rule of thumb: <strong>single-threaded fits well under ~100K reconciliation-scale records per run</strong>. Beyond that, measure your chunk-commit rate under production-like load before choosing a scaling strategy. If the rate is stable and the SLA is met, stay single-threaded.`,
        ],
      },
      {
        title: 'Under the Hood',
        body: [
          `<code>SimpleStepBuilder</code> defaults to a single thread — there is no extra configuration needed to stay single-threaded. The <code>JobRepository</code> stores one <code>BATCH_STEP_EXECUTION</code> row with <code>commit_count</code>, <code>read_count</code>, <code>write_count</code>, and <code>status</code>. On restart, the <code>ExecutionContext</code> (see 2.3) carries the reader's last committed position so only unprocessed records are replayed — not the full dataset.`,
          `Spring Boot 3.5 auto-configures the <code>JobRepository</code> and <code>PlatformTransactionManager</code>, so you inject them directly into <code>JobBuilder</code> and <code>StepBuilder</code> constructors (see 3.4) without adding <code>@EnableBatchProcessing</code>. Always pair scheduled jobs with a <code>JobParametersIncrementer</code> (see 2.4) to prevent <code>JobInstanceAlreadyCompleteException</code> on rerun.`,
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

import java.math.BigDecimal;

@Configuration
public class SingleThreadedReconciliationJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public SingleThreadedReconciliationJobConfig(JobRepository jobRepository,
                                                  PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job reconciliationJob(Step reconcileStep) {
        return new JobBuilder("reconciliationJob", jobRepository)
                .start(reconcileStep)
                .build();
    }

    @Bean
    public Step reconcileStep(ItemReader<TransactionRecord> reader,
                              ItemProcessor<TransactionRecord, ReconciledTransaction> processor,
                              ItemWriter<ReconciledTransaction> writer) {
        return new StepBuilder("reconcileStep", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(100, transactionManager)
                .reader(reader)
                .processor(processor)
                .writer(writer)
                // Intentionally single-threaded: no taskExecutor() configured
                .build();
    }

    @Bean
    public FlatFileItemReader<TransactionRecord> transactionReader() {
        return new FlatFileItemReaderBuilder<TransactionRecord>()
                .name("transactionReader")
                .resource(new FileSystemResource("data/transactions.csv"))
                .linesToSkip(1)
                .delimited()
                .names("transactionId", "accountId", "amount", "currency", "transactionDate", "status")
                .fieldSetMapper(new RecordFieldSetMapper<>(TransactionRecord.class))
                .build();
    }

    @Bean
    public ItemProcessor<TransactionRecord, ReconciledTransaction> reconciliationProcessor() {
        return record -> {
            boolean matched = record.amount().compareTo(BigDecimal.ZERO) > 0
                    && "SETTLED".equals(record.status());
            return new ReconciledTransaction(
                    record.transactionId(),
                    record.accountId(),
                    record.amount(),
                    matched ? "MATCHED" : "MISMATCHED",
                    matched ? "Auto-matched via single-threaded step" : "Amount or status mismatch"
            );
        };
    }

    @Bean
    public ItemWriter<ReconciledTransaction> reconciledWriter() {
        return chunk -> {
            for (ReconciledTransaction tx : chunk) {
                System.out.printf("Writing: %s -> %s%n", tx.transactionId(), tx.reconciliationStatus());
            }
        };
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'Decision Criteria',
        body: [
          `Use this architecture when: volume is under ~100K records per run; business logic is order-sensitive (running balances, sequential state machines); or your team lacks operational bandwidth for broker infrastructure. The single-threaded model should be the <em>default choice</em> — you opt out of it when measurement proves you must, not when the record count crosses an arbitrary threshold.`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — The "Bigger VM" Trap:</strong> Throwing more CPU/memory at a single-threaded step rarely helps. The bottleneck is sequential I/O and one-thread execution, not resource starvation. Profile the chunk-commit rate first before upgrading infrastructure.`,
          `<strong>Pitfall 2 — Missing JobParametersIncrementer:</strong> Without an incrementer, rerunning a scheduled job throws <code>JobInstanceAlreadyCompleteException</code>. Spring Boot 3.5 auto-configures a <code>RunIdIncrementer</code> only if you explicitly add it to the job builder — it is not automatic.`,
          `<strong>Pitfall 3 — Confusing Chunk Size with Throughput:</strong> Increasing chunk size from 100 to 5,000 reduces transaction overhead but increases rollback cost and memory pressure. A mid-chunk failure rolls back all 5,000 items, not just the failing one. Tune chunk size by measuring commit rate, not by guesswork.`,
          `<strong>Pitfall 4 — Adding @EnableBatchProcessing Unnecessarily:</strong> In Spring Boot 3.5, this annotation <em>disables</em> auto-configuration. Only add it when you need to customize the <code>JobRepository</code> or <code>PlatformTransactionManager</code>. Adding it "just to be safe" breaks the defaults.`,
        ],
        code: `// WRONG: Adding @EnableBatchProcessing without customization disables Boot 3.5 auto-config
@Configuration
@EnableBatchProcessing  // Don't do this unless customizing JobRepository/tx manager
public class BrokenConfig { }

// CORRECT: Let Spring Boot 3.5 auto-configure Batch
@Configuration
public class CorrectConfig {
    // Inject auto-configured JobRepository and PlatformTransactionManager
}`,
        codeLabel: 'java',
      },
    ],
    keyPoints: [
      `Single-threaded Spring Batch is a deliberate production architecture, not a temporary placeholder.`,
      `It preserves record order and avoids all distributed-system failure modes.`,
      `The warning sign for scaling out is a <strong>falling chunk-commit rate</strong>, not raw record count.`,
      `A practical rule of thumb: single-threaded fits well under ~100K reconciliation-scale records per run.`,
      `Spring Boot 3.5 auto-configures Batch; do not add <code>@EnableBatchProcessing</code> unless customizing the <code>JobRepository</code> or transaction manager.`,
      `Always use a <code>JobParametersIncrementer</code> for scheduled jobs to prevent <code>JobInstanceAlreadyCompleteException</code> on rerun.`,
    ],
    note: {
      label: 'DECISION POINT',
      text: `Before adding partitioning or multi-threading, measure your chunk-commit rate under production-like load. If the rate is stable and the job meets its SLA, stay single-threaded.`,
      tone: 'accent',
    },
    quiz: {
      question: `Your nightly reconciliation job processes 80,000 records in 45 minutes single-threaded, well within its 4-hour SLA. Over the next quarter, volume is projected to grow to 500,000 records. What is the most appropriate next step?`,
      options: [
        { label: `Immediately refactor to remote partitioning with Kafka`, correct: false },
        { label: `Add a TaskExecutor to the existing step for multi-threading`, correct: false },
        { label: `Measure the chunk-commit rate with 500K records first, then decide between local partitioning and multi-threading based on whether order must be preserved`, correct: true },
        { label: `Increase the chunk size from 100 to 5,000 to reduce transaction overhead`, correct: false },
      ],
      explanation: `Prematurely jumping to remote partitioning or multi-threading adds operational complexity without data. The correct approach is to measure first: if the chunk-commit rate stays flat and the job still meets its SLA, single-threaded may remain viable. If the rate falls or the SLA is at risk, local partitioning (if order is not required) or a larger chunk size (with tested memory/rollback bounds) are the next logical steps—not an immediate leap to distributed infrastructure.`,
    },
  },
  {
    id: '11.2',
    title: 'Multi-Threaded Steps (Non-Partitioned)',
    duration: '14 min',
    kind: 'concept',
    summary: [
      `The first scaling step from single-threaded is not partitioning — it is adding a <code>TaskExecutor</code> directly to a chunk step. One <code>StepExecution</code>, multiple concurrent chunk workers. Simple to configure, but with a critical thread-safety trap.`,
    ],
    topics: [
      {
        title: 'How It Works',
        body: [
          `Adding <code>.taskExecutor(taskExecutor)</code> to a <code>StepBuilder</code> turns a single-threaded step into a multi-threaded one. The framework still creates one <code>StepExecution</code> and one reader, processor, and writer instance — but the <code>TaskExecutor</code> dispatches chunk processing to a thread pool. Multiple chunks are read, processed, and written concurrently by different threads. No <code>Partitioner</code>, no broker, no remote infrastructure required.`,
        ],
        diagram: `<div class="diagram-caption">Architecture: Multi-Threaded Step</div><div class="dg-flow"><div class="dg-sync"><div class="dg-sync-box">SynchronizedItemStreamReader<span class="dg-sync-sub">serializes read() — one thread at a time</span></div></div><div class="dg-thread"><div class="dg-thread-label">Thread Pool (TaskExecutor) — concurrent chunk processors</div><div class="dg-workers"><div class="dg-worker"><div class="dg-worker-label">Worker 1</div><div class="dg-worker-steps"><div class="dg-mini-box">Processor</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Writer</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">commit</div></div></div><div class="dg-worker"><div class="dg-worker-label">Worker 2</div><div class="dg-worker-steps"><div class="dg-mini-box">Processor</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Writer</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">commit</div></div></div><div class="dg-worker"><div class="dg-worker-label">Worker 3</div><div class="dg-worker-steps"><div class="dg-mini-box">Processor</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Writer</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">commit</div></div></div><div class="dg-worker dg-box--dim"><div class="dg-worker-label">Worker N</div><div class="dg-worker-steps"><div class="dg-mini-box">Processor</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Writer</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">commit</div></div></div></div></div><div class="dg-repo"><div class="dg-box dg-box--green"><div class="dg-box-title">One StepExecution</div><div class="dg-box-sub">single read_count · write_count aggregated from all workers · commit order non-deterministic</div></div></div></div>`,
      },
      {
        title: 'The Thread-Safety Trap',
        body: [
          `The default <code>FlatFileItemReader</code> and <code>JdbcCursorItemReader</code> are <strong>not thread-safe</strong> — they maintain internal state (current line number, cursor position) that is not protected by synchronization. If two threads call <code>read()</code> simultaneously, the state corrupts and you get skipped records, duplicate processing, or a <code>NullPointerException</code>.`,
          `Spring Batch provides <code>SynchronizedItemStreamReader</code> as a wrapper that serializes access with a <code>synchronized</code> block — only one thread reads at a time, while processing and writing still happen in parallel. The trade-off: reading becomes a serial bottleneck. If your step is CPU-bound in the processor, this is fine. If it is I/O-bound in the reader, the gain is minimal.`,
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
import org.springframework.batch.item.support.SynchronizedItemStreamReader;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;

@Configuration
public class MultiThreadedStepConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public MultiThreadedStepConfig(JobRepository jobRepository,
                                   PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job multiThreadedReconciliationJob() {
        return new JobBuilder("multiThreadedReconciliationJob", jobRepository)
                .start(multiThreadedReconcileStep())
                .build();
    }

    @Bean
    public Step multiThreadedReconcileStep() {
        return new StepBuilder("multiThreadedReconcileStep", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(100, transactionManager)
                .reader(synchronizedReader())
                .processor(reconciliationProcessor())
                .writer(reconciledWriter())
                .taskExecutor(batchTaskExecutor())
                .build();
    }

    // The underlying reader is NOT thread-safe. We wrap it.
    @Bean
    public SynchronizedItemStreamReader<TransactionRecord> synchronizedReader() {
        FlatFileItemReader<TransactionRecord> delegate = new FlatFileItemReaderBuilder<TransactionRecord>()
                .name("transactionReader")
                .resource(new FileSystemResource("data/transactions.csv"))
                .linesToSkip(1)
                .delimited()
                .names("transactionId", "accountId", "amount", "currency", "transactionDate", "status")
                .fieldSetMapper(new RecordFieldSetMapper<>(TransactionRecord.class))
                .build();

        return new SynchronizedItemStreamReader<>(delegate);
    }

    @Bean
    public ItemProcessor<TransactionRecord, ReconciledTransaction> reconciliationProcessor() {
        return record -> {
            boolean matched = record.amount().compareTo(BigDecimal.ZERO) > 0
                    && "SETTLED".equals(record.status());
            return new ReconciledTransaction(
                    record.transactionId(),
                    record.accountId(),
                    record.amount(),
                    matched ? "MATCHED" : "MISMATCHED",
                    matched ? "Multi-threaded match" : "Mismatch"
            );
        };
    }

    @Bean
    public ItemWriter<ReconciledTransaction> reconciledWriter() {
        return chunk -> {
            System.out.printf("Thread %s writing chunk of %d%n",
                    Thread.currentThread().getName(), chunk.size());
        };
    }

    @Bean
    public TaskExecutor batchTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("batch-worker-");
        executor.initialize();
        return executor;
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'Ordering and Restart Limitations',
        body: [
          `Because chunks are processed concurrently, commit order is <strong>non-deterministic</strong>. If your business logic requires strict record ordering — running-balance calculations, sequential state machines — multi-threaded steps are unsafe regardless of synchronization. Chunks may commit in any order, and a restart after a mid-chunk failure can leave data in an inconsistent state relative to the input sequence.`,
          `For reconciliation jobs that match individual transactions against a ledger with no ordering dependency, this is acceptable. For jobs that compute cumulative totals or depend on temporal sequence, stay single-threaded or use partitioned steps with range-based ordering guarantees.`,
        ],
      },
      {
        title: 'Sizing the Thread Pool',
        body: [
          `Use a <code>ThreadPoolTaskExecutor</code> with a bounded queue and a rejection policy. A <code>corePoolSize</code> of 4–8 is a reasonable starting point for I/O-bound reconciliation work. The pool size must not exceed the number of database connections in your pool — each chunk holds a transaction (and a connection) until the writer commits. If the pool is larger than the connection pool, threads block waiting for connections and you lose all parallelism benefit.`,
        ],
        code: `// WRONG: Unbounded pool + unbounded queue = memory exhaustion under load
@Bean
public TaskExecutor badExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(50);      // Way larger than DB connection pool
    executor.setMaxPoolSize(Integer.MAX_VALUE);
    // No queue capacity set — defaults to Integer.MAX_VALUE
    return executor;
}

// CORRECT: Bounded pool sized relative to your connection pool
@Bean
public TaskExecutor goodExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(4);       // Match your DB pool / 2 for safety
    executor.setMaxPoolSize(8);
    executor.setQueueCapacity(100);    // Bounded — rejects if overloaded
    executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
    executor.setThreadNamePrefix("batch-worker-");
    executor.initialize();
    return executor;
}`,
        codeLabel: 'java',
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Forgetting SynchronizedItemStreamReader:</strong> The #1 bug when moving to multi-threaded steps. <code>FlatFileItemReader</code>, <code>JdbcCursorItemReader</code>, and most custom readers maintain mutable state that corrupts under concurrent access. Symptoms: skipped records, duplicate processing, <code>NullPointerException</code>. Always wrap non-thread-safe readers.`,
          `<strong>Pitfall 2 — Pool Size > Connection Pool Size:</strong> Each concurrent chunk holds a database connection until commit. If your thread pool has 16 workers but your HikariCP only has 10 connections, 6 threads will block on <code>getConnection()</code>, negating parallelism and potentially timing out. Size the thread pool at most half your connection pool.`,
          `<strong>Pitfall 3 — Assuming Deterministic Commit Order:</strong> Chunk 1 may commit after Chunk 5. If downstream systems depend on write order (e.g., event sourcing, running totals), multi-threaded steps will silently corrupt state. This is a design-level mismatch, not a configuration fix.`,
          `<strong>Pitfall 4 — Shared Mutable State in Processor/Writer:</strong> Since the framework typically creates one processor and writer instance shared across threads, any mutable fields (counters, caches, <code>StringBuilder</code>) race. Keep processors stateless. If you need aggregation, use a <code>ItemStream</code> callback with proper synchronization or move to partitioning.`,
        ],
        code: `// WRONG: Stateful processor shared across threads — count is corrupted
@Bean
public ItemProcessor<TransactionRecord, ReconciledTransaction> badProcessor() {
    return new ItemProcessor<>() {
        private int count = 0;  // Race condition!
        @Override
        public ReconciledTransaction process(TransactionRecord record) {
            count++;
            // ... logic
        }
    };
}

// CORRECT: Stateless processor — no mutable fields
@Bean
public ItemProcessor<TransactionRecord, ReconciledTransaction> goodProcessor() {
    return record -> {
        boolean matched = record.amount().compareTo(BigDecimal.ZERO) > 0
                && "SETTLED".equals(record.status());
        return new ReconciledTransaction(
                record.transactionId(),
                record.accountId(),
                record.amount(),
                matched ? "MATCHED" : "MISMATCHED",
                matched ? "OK" : "FAIL"
        );
    };
}`,
        codeLabel: 'java',
      },
    ],
    keyPoints: [
      `Multi-threaded steps add a <code>TaskExecutor</code> to a chunk step — the simplest scaling approach.`,
      `Reader/processor/writer instances are typically shared across threads unless explicitly scoped.`,
      `Wrap non-thread-safe readers with <code>SynchronizedItemStreamReader</code> to prevent state corruption.`,
      `Multi-threaded steps break strict record ordering — unsafe for cumulative or sequence-dependent logic.`,
      `Pool size must not exceed the database connection pool size, or threads will block on connection acquisition.`,
      `This is a natural stepping stone before committing to full partitioning (11.4).`,
    ],
    note: {
      label: 'WARNING',
      text: `Never add taskExecutor() to a step without auditing reader thread-safety. FlatFileItemReader, JdbcCursorItemReader, and most custom readers are stateful and will corrupt under concurrent access.`,
      tone: 'accent',
    },
    quiz: {
      question: `You add <code>.taskExecutor(new ThreadPoolTaskExecutor())</code> to a chunk step that uses a plain <code>FlatFileItemReader</code>. During load testing, you observe skipped records and duplicate processing. What is the root cause?`,
      options: [
        { label: `The chunk size is too small, causing excessive transaction overhead`, correct: false },
        { label: `The FlatFileItemReader is not thread-safe, and concurrent read() calls corrupt its internal line-number state`, correct: true },
        { label: `The database connection pool is exhausted, causing threads to time out`, correct: false },
        { label: `The writer is not flushing its buffer between chunk commits`, correct: false },
      ],
      explanation: `FlatFileItemReader maintains internal mutable state (current line number, buffered reader position) that is not synchronized. When multiple threads call read() concurrently, one thread may advance the cursor while another is mid-read, causing skipped lines or double-reads. The fix is to wrap the reader in SynchronizedItemStreamReader, which serializes access. This is the #1 bug when moving from single-threaded to multi-threaded steps.`,
    },
  },
  {
    id: '11.3',
    title: 'Partitioning Prerequisites: @StepScope & ExecutionContext',
    duration: '16 min',
    kind: 'concept',
    summary: [
      `Before you can distribute work across partitions, you must understand the machinery that makes per-partition state possible. <code>@StepScope</code> and <code>ExecutionContext</code> are the two prerequisites that enable local and remote partitioning. Misunderstanding either is the #1 cause of partitioning bugs in production.`,
    ],
    topics: [
      {
        title: 'Why @StepScope Is Required',
        body: [
          `In a partitioned step, each partition needs its own <code>ItemReader</code> configured with different bounds — partition 1 reads accounts <code>0001–1000</code>, partition 2 reads <code>1001–2000</code>, and so on. If the reader is a singleton bean, all partitions share the same instance, and the last partition to start overwrites the bounds for everyone.`,
          `<code>@StepScope</code> tells Spring to create a new bean instance <em>per step execution</em>, not per application context. In partitioning, each partition gets its own <code>StepExecution</code>, so each partition gets its own reader instance. Without <code>@StepScope</code>, the reader is built once, eagerly, at application startup — before any partition context exists — and all partitions read the same data or crash with conflicting state.`,
        ],
        diagram: `<div class="diagram-caption">@StepScope: One Bean Per StepExecution</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">Application Context Startup</div><div class="dg-pipe"><div class="dg-box dg-box--dim"><div class="dg-box-title">@Bean (singleton)</div><div class="dg-box-sub">One instance · shared · eager init</div></div><div class="dg-arrow"><span>→</span><small>WRONG</small></div><div class="dg-box dg-box--red"><div class="dg-box-title">All partitions share reader</div><div class="dg-box-sub">Bounds overwritten · race conditions</div></div></div></div><div class="dg-thread"><div class="dg-thread-label">Partition 1 StepExecution</div><div class="dg-pipe"><div class="dg-box dg-box--accent"><div class="dg-box-title">@StepScope @Bean</div><div class="dg-box-sub">minId=1 · maxId=1000</div></div><div class="dg-arrow"><span>→</span><small>OWN INSTANCE</small></div><div class="dg-box dg-box--green dg-box--inline"><div class="dg-box-title">Reader P1</div><div class="dg-box-sub">isolated · lazy init on first use</div></div></div></div><div class="dg-thread"><div class="dg-thread-label">Partition 2 StepExecution</div><div class="dg-pipe"><div class="dg-box dg-box--accent"><div class="dg-box-title">@StepScope @Bean</div><div class="dg-box-sub">minId=1001 · maxId=2000</div></div><div class="dg-arrow"><span>→</span><small>OWN INSTANCE</small></div><div class="dg-box dg-box--green dg-box--inline"><div class="dg-box-title">Reader P2</div><div class="dg-box-sub">isolated · lazy init on first use</div></div></div></div></div>`,
      },
      {
        title: 'SpEL Resolution Mechanics',
        body: [
          `<code>@StepScope</code> enables late binding via SpEL expressions that resolve against the <code>StepExecutionContext</code>. When a partition is created, the <code>Partitioner</code> populates each partition's <code>ExecutionContext</code> with keys like <code>minId</code> and <code>maxId</code>. The reader bean then uses <code>#{stepExecutionContext['minId']}</code> to read its assigned range.`,
          `The SpEL expression is evaluated when the bean is first accessed within the step, not at startup. This is critical: the <code>StepExecution</code> (and its <code>ExecutionContext</code>) does not exist until the partition is actually started by the <code>PartitionHandler</code>. <code>@StepScope</code> bridges this gap by deferring instantiation until the step execution context is available.`,
        ],
        code: `package com.example.reconciliation.batch;

import com.example.reconciliation.domain.TransactionRecord;
import org.springframework.batch.item.database.JdbcPagingItemReader;
import org.springframework.batch.item.database.PagingQueryProvider;
import org.springframework.batch.item.database.builder.JdbcPagingItemReaderBuilder;
import org.springframework.batch.item.database.support.SqlPagingQueryProviderFactoryBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.batch.core.configuration.annotation.StepScope;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

@Configuration
public class PartitionedReaderConfig {

    // This bean is created ONCE per step execution (i.e., per partition)
    @Bean
    @StepScope
    public JdbcPagingItemReader<TransactionRecord> partitionReader(
            DataSource dataSource,
            @Value("#{stepExecutionContext['minId']}") Long minId,
            @Value("#{stepExecutionContext['maxId']}") Long maxId) throws Exception {

        Map<String, Object> parameterValues = new HashMap<>();
        parameterValues.put("minId", minId);
        parameterValues.put("maxId", maxId);

        SqlPagingQueryProviderFactoryBean provider = new SqlPagingQueryProviderFactoryBean();
        provider.setDataSource(dataSource);
        provider.setSelectClause("SELECT transaction_id, account_id, amount, currency, transaction_date, status");
        provider.setFromClause("FROM transactions");
        provider.setWhereClause("WHERE account_id >= :minId AND account_id <= :maxId");
        provider.setSortKey("account_id");

        return new JdbcPagingItemReaderBuilder<TransactionRecord>()
                .name("partitionReader")
                .dataSource(dataSource)
                .queryProvider(provider.getObject())
                .parameterValues(parameterValues)
                .pageSize(100)
                .rowMapper((rs, rowNum) -> new TransactionRecord(
                        rs.getString("transaction_id"),
                        rs.getString("account_id"),
                        rs.getBigDecimal("amount"),
                        rs.getString("currency"),
                        rs.getDate("transaction_date").toLocalDate(),
                        rs.getString("status")
                ))
                .build();
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'ExecutionContext as Partition Contract',
        body: [
          `The <code>ExecutionContext</code> is the contract between the <code>Partitioner</code> and the worker step. The partitioner writes key-value pairs into each partition's context; the worker step reads them via SpEL. This context is persisted to the <code>BATCH_STEP_EXECUTION_CONTEXT</code> table, which means partition state survives restarts.`,
          `For the reconciliation domain, a typical partitioner splits by <code>accountId</code> range. Partition 0 gets <code>{minId: 1, maxId: 1000}</code>; Partition 1 gets <code>{minId: 1001, maxId: 2000}</code>. The worker step's reader uses these bounds in its <code>WHERE</code> clause. Because each partition has its own <code>StepExecution</code> and <code>ExecutionContext</code>, restart granularity is per-partition: a failed partition restarts from its own last committed chunk, not from the beginning of the job.`,
        ],
        diagram: `<div class="diagram-caption">Partitioner → ExecutionContext → Worker Binding</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">Partitioner (Master)</div><div class="dg-pipe"><div class="dg-box dg-box--accent"><div class="dg-box-title">RangePartitioner</div><div class="dg-box-sub">partition(gridSize) → Map&lt;String, ExecutionContext&gt;</div></div><div class="dg-arrow"><span>→</span><small>creates</small></div><div class="dg-box dg-box--green dg-box--inline"><div class="dg-box-title">Partition 0 Context</div><div class="dg-box-sub">{minId=1, maxId=1000}</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--green dg-box--inline"><div class="dg-box-title">Partition 1 Context</div><div class="dg-box-sub">{minId=1001, maxId=2000}</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--dim"><div class="dg-box-title">Partition N Context</div><div class="dg-box-sub">{minId=..., maxId=...}</div></div></div></div><div class="dg-thread"><div class="dg-thread-label">Worker Step (Per Partition)</div><div class="dg-pipe"><div class="dg-box dg-box--green dg-box--inline"><div class="dg-box-title">StepExecution + Context</div><div class="dg-box-sub">persisted to BATCH_STEP_EXECUTION_CONTEXT</div></div><div class="dg-arrow"><span>→</span><small>SpEL resolves</small></div><div class="dg-box dg-box--accent"><div class="dg-box-title">@StepScope Reader</div><div class="dg-box-sub">WHERE account_id BETWEEN :minId AND :maxId</div></div></div></div></div>`,
      },
      {
        title: 'The Eager Instantiation Bug',
        body: [
          `The most common partitioning bug is forgetting <code>@StepScope</code> and having Spring instantiate the reader at application startup. At that point, <code>stepExecutionContext['minId']</code> does not exist — the partition hasn't been created yet. Depending on your SpEL expression, this either fails with a <code>SpelEvaluationException</code> (variable not found) or silently resolves to <code>null</code>, causing the reader to query the entire table in every partition.`,
          `The symptom in production: all partitions process the same data range, producing duplicate writes. The fix is always <code>@StepScope</code> on the reader bean. If you are using component scanning and <code>@Component</code> instead of explicit <code>@Bean</code> methods, you must add <code>@StepScope</code> to the class itself.`,
        ],
        code: `// WRONG: Reader instantiated at startup — stepExecutionContext does not exist yet
@Bean
public JdbcPagingItemReader<TransactionRecord> brokenReader(
        @Value("#{stepExecutionContext['minId']}") Long minId) {  // SpelEvaluationException!
    // ...
}

// WRONG: Singleton reader — all partitions share one instance, overwriting bounds
@Bean
public JdbcPagingItemReader<TransactionRecord> sharedReader() {
    // minId/maxId set via setter after startup — race condition across partitions
}

// CORRECT: @StepScope defers creation until step execution context is available
@Bean
@StepScope
public JdbcPagingItemReader<TransactionRecord> partitionReader(
        @Value("#{stepExecutionContext['minId']}") Long minId,
        @Value("#{stepExecutionContext['maxId']}") Long maxId) {
    // Each partition gets its own reader with its own bound parameters
}`,
        codeLabel: 'java',
      },
      {
        title: 'ExecutionContext Serialization for Remote Partitioning',
        body: [
          `For local partitioning (11.4), the <code>ExecutionContext</code> stays in-memory within the same JVM. For remote partitioning (11.9), the partition's <code>ExecutionContext</code> is serialized and sent over a message broker to a worker JVM. This means every object you place in the context must implement <code>java.io.Serializable</code>.`,
          `A common mistake is putting a <code>DataSource</code>, <code>JdbcTemplate</code>, or a custom non-serializable boundary object into the partition context. These will fail at send time with a <code>NotSerializableException</code>. Stick to primitives, Strings, and simple serializable value objects for partition metadata. The reader itself is never serialized — only the <code>minId</code>/<code>maxId</code> bounds are.`,
        ],
        code: `// WRONG: Non-serializable object in partition context
public class BadPartitioner implements Partitioner {
    @Override
    public Map<String, ExecutionContext> partition(int gridSize) {
        Map<String, ExecutionContext> map = new HashMap<>();
        ExecutionContext ctx = new ExecutionContext();
        ctx.put("dataSource", dataSource);  // NotSerializableException on remote send!
        ctx.put("template", jdbcTemplate);  // Same problem
        map.put("partition0", ctx);
        return map;
    }
}

// CORRECT: Only serializable primitives in partition context
public class GoodPartitioner implements Partitioner {
    @Override
    public Map<String, ExecutionContext> partition(int gridSize) {
        Map<String, ExecutionContext> map = new HashMap<>();
        for (int i = 0; i < gridSize; i++) {
            ExecutionContext ctx = new ExecutionContext();
            ctx.putLong("minId", i * 1000L + 1);
            ctx.putLong("maxId", (i + 1) * 1000L);
            map.put("partition" + i, ctx);  // Long and String are serializable
        }
        return map;
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Forgetting @StepScope:</strong> The #1 partitioning bug. Without it, the reader is a singleton, all partitions share state, and you get duplicate processing or <code>SpelEvaluationException</code>. Always audit your reader beans for <code>@StepScope</code> before enabling partitioning.`,
          `<strong>Pitfall 2 — Non-Serializable Partition Metadata:</strong> When moving from local to remote partitioning, <code>ExecutionContext</code> contents are serialized over the wire. Any non-serializable value (DataSource, custom objects, closures) throws at runtime. Design partition metadata as plain primitives from the start.`,
          `<strong>Pitfall 3 — Spelling Mismatches in SpEL:</strong> <code>#{stepExecutionContext['minId']}</code> must exactly match the key put by the partitioner. A typo like <code>minID</code> vs <code>minId</code> resolves to <code>null</code>, and the reader queries unbounded data. Use constants shared between partitioner and reader configuration.`,
          `<strong>Pitfall 4 — Assuming @StepScope Fixes Thread Safety:</strong> <code>@StepScope</code> isolates instances per step execution, but within a multi-threaded step (11.2), the same step execution still dispatches chunks to multiple threads. If you combine <code>@StepScope</code> with <code>taskExecutor()</code> on the same step, you still need <code>SynchronizedItemStreamReader</code> or a thread-safe reader implementation.`,
        ],
      },
    ],
    keyPoints: [
      `<code>@StepScope</code> creates one bean instance per <code>StepExecution</code>, which means one per partition in partitioned jobs.`,
      `Without <code>@StepScope</code>, the reader is built eagerly at startup before partition context exists — the #1 partitioning bug.`,
      `SpEL expressions like <code>#{stepExecutionContext['minId']}</code> are resolved lazily when the step execution starts, not at application context refresh.`,
      `The <code>ExecutionContext</code> is the contract between partitioner and worker; it is persisted to <code>BATCH_STEP_EXECUTION_CONTEXT</code> and enables per-partition restart.`,
      `For remote partitioning, all <code>ExecutionContext</code> values must be <code>Serializable</code>. Never put DataSource, JdbcTemplate, or non-serializable objects in partition metadata.`,
      `<code>@StepScope</code> solves instance isolation, not intra-step thread safety. Multi-threaded partitioned steps still need thread-safe readers or <code>SynchronizedItemStreamReader</code>.`,
    ],
    note: {
      label: 'CRITICAL',
      text: `Before enabling any form of partitioning, verify that every reader bean involved has @StepScope. This one annotation prevents the most common class of partitioning failures.`,
      tone: 'accent',
    },
    quiz: {
      question: `You configure a partitioned step with a custom <code>RangePartitioner</code> that puts <code>minId</code> and <code>maxId</code> into each partition's <code>ExecutionContext</code>. The job starts, but all partitions query the entire <code>transactions</code> table instead of their assigned ranges. What is the most likely cause?`,
      options: [
        { label: `The Partitioner is not returning the correct gridSize`, correct: false },
        { label: `The ItemReader bean is missing @StepScope, so it is instantiated once at startup before partition context exists`, correct: true },
        { label: `The ExecutionContext keys are not persisted to the JobRepository`, correct: false },
        { label: `The chunk size is too large, causing the reader to ignore the WHERE clause bounds`, correct: false },
      ],
      explanation: `Without @StepScope, the ItemReader is a singleton bean created at application context startup. At that point, no StepExecution (and therefore no stepExecutionContext) exists yet. The SpEL expression either fails or resolves to null, and the reader ends up with no bounds filter. Every partition then uses the same unbounded reader instance, querying the full table. Adding @StepScope defers instantiation until the partition's StepExecution is created, at which point the SpEL expressions resolve correctly.`,
    },
  },
   {
    id: '11.4',
    title: 'Architecture 2: Local Master-Slave — the Partitioner Contract',
    duration: '14 min',
    kind: 'concept',
    summary: [
      `Local partitioning splits one step's data into independent partitions, each processed by a separate thread within the same JVM. The <code>Partitioner</code> defines the split; the <code>TaskExecutorPartitionHandler</code> dispatches work. This is the first architecture that truly scales data-parallel batch processing without leaving the single JVM.`,
    ],
    topics: [
      {
        title: 'The Partitioner Interface',
        body: [
          `A <code>Partitioner</code> has one method: <code>Map&lt;String, ExecutionContext&gt; partition(int gridSize)</code>. It receives a <code>gridSize</code> hint (the desired number of partitions) and returns a map where each key is a partition name and each value is an <code>ExecutionContext</code> containing the metadata that partition needs to do its work.`,
          `The <code>gridSize</code> is a hint, not a mandate. A partitioner may return fewer or more partitions than requested based on the actual data distribution. For example, if your table only has 3 distinct account ranges but <code>gridSize</code> is 8, a smart partitioner returns 3 partitions, not 8 empty ones. The framework adapts — it creates one <code>StepExecution</code> per entry in the returned map, regardless of <code>gridSize</code>.`,
        ],
        code: `package com.example.reconciliation.batch.partition;

import org.springframework.batch.core.partition.support.Partitioner;
import org.springframework.batch.item.ExecutionContext;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

public class AccountIdRangePartitioner implements Partitioner {

    private final DataSource dataSource;

    public AccountIdRangePartitioner(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public Map<String, ExecutionContext> partition(int gridSize) {
        Map<String, ExecutionContext> map = new HashMap<>();

        // Get min/max account_id from the actual data
        long minId, maxId;
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                 "SELECT MIN(account_id) as min_id, MAX(account_id) as max_id FROM transactions")) {
            rs.next();
            minId = rs.getLong("min_id");
            maxId = rs.getLong("max_id");
        } catch (Exception e) {
            throw new RuntimeException("Failed to compute partition ranges", e);
        }

        long range = (maxId - minId + 1) / gridSize;
        if (range == 0) range = 1;

        for (int i = 0; i < gridSize; i++) {
            long start = minId + (i * range);
            long end = (i == gridSize - 1) ? maxId : (start + range - 1);

            ExecutionContext ctx = new ExecutionContext();
            ctx.putLong("minId", start);
            ctx.putLong("maxId", end);
            ctx.putString("partitionName", "partition" + i);
            map.put("partition" + i, ctx);
        }

        return map;
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'The TaskExecutorPartitionHandler',
        body: [
          `The <code>TaskExecutorPartitionHandler</code> is the engine that takes the partition map from the <code>Partitioner</code> and dispatches each partition as a separate step execution on the provided <code>TaskExecutor</code>. It is the bridge between the partition definition and actual concurrent execution.`,
          `The handler polls the <code>JobRepository</code> via <code>JobExplorer</code> to track when each partition's <code>StepExecution</code> completes. The <code>pollInterval</code> property controls how often it checks — a trade-off between responsiveness and database load. A shorter poll interval detects completion faster but hammers the <code>BATCH_STEP_EXECUTION</code> table.`,
        ],
        diagram: `<div class="diagram-caption">Local Partitioning: Master + TaskExecutorPartitionHandler</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">Master Step</div><div class="dg-pipe"><div class="dg-box dg-box--accent"><div class="dg-box-title">Partitioner</div><div class="dg-box-sub">partition(4) → 4 ExecutionContexts</div></div><div class="dg-arrow"><span>→</span><small>dispatches</small></div><div class="dg-box dg-box--green"><div class="dg-box-title">TaskExecutorPartitionHandler</div><div class="dg-box-sub">pollInterval=5s · polls JobRepository</div></div></div></div><div class="dg-workers"><div class="dg-worker"><div class="dg-worker-label">Partition 0</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--accent">Reader</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Processor</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Writer</div></div><div class="dg-box-sub">minId=1 · maxId=2500</div></div><div class="dg-worker"><div class="dg-worker-label">Partition 1</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--accent">Reader</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Processor</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Writer</div></div><div class="dg-box-sub">minId=2501 · maxId=5000</div></div><div class="dg-worker"><div class="dg-worker-label">Partition 2</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--accent">Reader</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Processor</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Writer</div></div><div class="dg-box-sub">minId=5001 · maxId=7500</div></div><div class="dg-worker"><div class="dg-worker-label">Partition 3</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--accent">Reader</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Processor</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Writer</div></div><div class="dg-box-sub">minId=7501 · maxId=10000</div></div></div><div class="dg-repo"><div class="dg-box dg-box--green"><div class="dg-box-title">JobRepository</div><div class="dg-box-sub">4 StepExecution rows · 1 per partition · polled by handler</div></div></div></div>`,
      },
      {
        title: 'Wiring It Together',
        body: [
          `The master step is a special step that does not read/process/write items itself. Instead, it delegates to the <code>PartitionHandler</code>, which in turn delegates to the worker step. The worker step is the actual chunk-oriented step that processes data — it is reused for every partition.`,
          `The master step's <code>Partitioner</code> runs once at the start of the master step. The <code>TaskExecutorPartitionHandler</code> then submits each partition as a separate task to the thread pool. Each task executes the worker step with its own <code>StepExecution</code> and <code>ExecutionContext</code>.`,
        ],
        code: `package com.example.reconciliation.batch;

import com.example.reconciliation.batch.partition.AccountIdRangePartitioner;
import com.example.reconciliation.domain.ReconciledTransaction;
import com.example.reconciliation.domain.TransactionRecord;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.partition.support.Partitioner;
import org.springframework.batch.core.partition.support.TaskExecutorPartitionHandler;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemReader;
import org.springframework.batch.item.ItemWriter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;

@Configuration
public class LocalPartitioningJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;
    private final DataSource dataSource;

    public LocalPartitioningJobConfig(JobRepository jobRepository,
                                       PlatformTransactionManager transactionManager,
                                       DataSource dataSource) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
        this.dataSource = dataSource;
    }

    @Bean
    public Job partitionedReconciliationJob() {
        return new JobBuilder("partitionedReconciliationJob", jobRepository)
                .start(masterStep())
                .build();
    }

    // Master step: only partitions and dispatches — no R/P/W of its own
    @Bean
    public Step masterStep() {
        TaskExecutorPartitionHandler partitionHandler = new TaskExecutorPartitionHandler();
        partitionHandler.setStep(workerStep());
        partitionHandler.setTaskExecutor(partitionTaskExecutor());
        partitionHandler.setGridSize(4);
        partitionHandler.setJobRepository(jobRepository);

        return new StepBuilder("masterStep", jobRepository)
                .partitioner("workerStep", partitioner())
                .partitionHandler(partitionHandler)
                .build();
    }

    @Bean
    public Partitioner partitioner() {
        return new AccountIdRangePartitioner(dataSource);
    }

    // Worker step: the actual chunk step executed once per partition
    @Bean
    public Step workerStep() {
        return new StepBuilder("workerStep", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(100, transactionManager)
                .reader(partitionReader(null, null))  // @StepScope params resolved at runtime
                .processor(reconciliationProcessor())
                .writer(reconciledWriter())
                .build();
    }

    @Bean
    public TaskExecutor partitionTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(0);  // Direct handoff — no queue backlog
        executor.setThreadNamePrefix("partition-worker-");
        executor.initialize();
        return executor;
    }

    // Reader bean with @StepScope — see 11.3 for full implementation
    @Bean
    @StepScope
    public ItemReader<TransactionRecord> partitionReader(
            @org.springframework.beans.factory.annotation.Value("#{stepExecutionContext['minId']}") Long minId,
            @org.springframework.beans.factory.annotation.Value("#{stepExecutionContext['maxId']}") Long maxId) {
        // JdbcPagingItemReader configured with minId/maxId bounds
        // Full implementation omitted for brevity — see 11.3
        return null;
    }

    @Bean
    public ItemProcessor<TransactionRecord, ReconciledTransaction> reconciliationProcessor() {
        return record -> new ReconciledTransaction(
                record.transactionId(),
                record.accountId(),
                record.amount(),
                "MATCHED",
                "Partitioned reconciliation"
        );
    }

    @Bean
    public ItemWriter<ReconciledTransaction> reconciledWriter() {
        return chunk -> {
            System.out.printf("Partition thread %s wrote %d items%n",
                    Thread.currentThread().getName(), chunk.size());
        };
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — gridSize vs Pool Size Mismatch:</strong> If <code>gridSize</code> is 8 but your <code>TaskExecutor</code> only has 4 threads, 4 partitions run concurrently and 4 wait in the queue. The job still completes, but peak parallelism is capped by the pool, not the grid size. Align them for predictable throughput.`,
          `<strong>Pitfall 2 — Forgetting to Set JobRepository on PartitionHandler:</strong> <code>TaskExecutorPartitionHandler</code> needs a <code>JobRepository</code> to persist partition <code>StepExecution</code> rows. Without it, partitions run but their status is never recorded — restarts fail because Spring Batch cannot find the prior execution state.`,
          `<strong>Pitfall 3 — Worker Step Name Mismatch:</strong> The master step's <code>partitioner("workerStep", partitioner)</code> name must match the worker step bean name exactly. A typo means the handler cannot find the step definition and throws <code>NoSuchStepException</code> at runtime.`,
          `<strong>Pitfall 4 — Shared Writer State Across Partitions:</strong> If the writer maintains a cache, counter, or batch buffer, multiple partitions writing through the same instance race. Use <code>@StepScope</code> on the writer or ensure it is stateless. For JDBC batch writers, this is usually fine; for custom writers, audit carefully.`,
        ],
      },
    ],
    keyPoints: [
      `A <code>Partitioner</code> returns a <code>Map&lt;String, ExecutionContext&gt;</code> — each entry becomes one partition.`,
      `<code>gridSize</code> is a hint; the partitioner may return fewer or more partitions based on actual data.`,
      `<code>TaskExecutorPartitionHandler</code> dispatches partitions to a thread pool and polls the JobRepository for completion.`,
      `The master step has no R/P/W — it only partitions. The worker step is the actual chunk step reused per partition.`,
      `Align <code>gridSize</code> with your thread pool size for predictable parallelism.`,
      `Always set <code>JobRepository</code> on the <code>TaskExecutorPartitionHandler</code> or partition state is lost.`,
    ],
    note: {
      label: 'KEY INSIGHT',
      text: `Local partitioning keeps everything in one JVM — no message broker, no network serialization, no distributed failure modes. It is the scaling architecture you should reach for first before considering remote partitioning.`,
      tone: 'accent',
    },
    quiz: {
      question: `You configure a partitioned step with <code>gridSize=8</code> and a <code>ThreadPoolTaskExecutor</code> with <code>corePoolSize=4</code>. How many partitions run concurrently at peak?`,
      options: [
        { label: `8 — gridSize always determines concurrency`, correct: false },
        { label: `4 — capped by the thread pool size`, correct: true },
        { label: `12 — the sum of gridSize and pool size`, correct: false },
        { label: `2 — half the pool size because each partition needs two threads`, correct: false },
      ],
      explanation: `TaskExecutorPartitionHandler submits partitions as Runnable tasks to the provided TaskExecutor. If the executor only has 4 threads, only 4 partitions can run concurrently regardless of gridSize. The remaining 4 partitions wait in the executor's queue until a thread becomes available. To maximize throughput, set gridSize equal to (or slightly above) the thread pool size.`,
    },
  },
  {
    id: '11.5',
    title: 'Partition Strategies & the Straggler Problem',
    duration: '12 min',
    kind: 'concept',
    summary: [
      `How you split data determines whether partitioning actually speeds up your job. Even splits yield linear speedup; skewed splits create stragglers that negate parallelism. This lecture covers the three main partitioning strategies and how to diagnose and fix skew.`,
    ],
    topics: [
      {
        title: 'Range-Based Partitioning',
        body: [
          `Range-based partitioning divides the key space into equal-width ranges: <code>1–1000</code>, <code>1001–2000</code>, etc. It is the simplest to implement — one <code>MIN()</code>/<code>MAX()</code> query and simple arithmetic.`,
          `The problem: real data is never uniform. If 80% of transactions cluster in the <code>1–1000</code> account range (e.g., high-activity corporate accounts), that partition processes 80% of the data while the others sit idle. The job's total runtime is dictated by the slowest partition — this is the <strong>straggler problem</strong>.`,
        ],
        diagram: `<div class="diagram-caption">Range-Based Partitioning: The Straggler Problem</div><div class="dg-flow"><div class="dg-workers"><div class="dg-worker"><div class="dg-worker-label">Partition 0</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--red">80K records</div></div><div class="dg-box-sub">Range 1-1000 · 8 min</div></div><div class="dg-worker"><div class="dg-worker-label">Partition 1</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--green">5K records</div></div><div class="dg-box-sub">Range 1001-2000 · 30 sec</div></div><div class="dg-worker"><div class="dg-worker-label">Partition 2</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--green">5K records</div></div><div class="dg-box-sub">Range 2001-3000 · 30 sec</div></div><div class="dg-worker"><div class="dg-worker-label">Partition 3</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--green">10K records</div></div><div class="dg-box-sub">Range 3001-4000 · 1 min</div></div></div><div class="dg-repo"><div class="dg-box dg-box--red"><div class="dg-box-title">Total Job Time: 8 min</div><div class="dg-box-sub">Dictated by straggler · 3 partitions idle for 7.5 min</div></div></div></div>`,
      },
      {
        title: 'Modulo (Hash) Partitioning',
        body: [
          `Modulo partitioning assigns records based on <code>accountId % gridSize</code>. This spreads records evenly when the key distribution is random, but it has two drawbacks for batch processing.`,
          `First, it is hard to resume efficiently. A range-based reader can use <code>BETWEEN</code> with an index seek; a modulo filter requires a full table scan with a <code>WHERE MOD(account_id, 4) = 0</code> predicate, which most databases cannot index efficiently. Second, modulo does not preserve ordering within a partition — records are interleaved across the source table, so range-based restart positioning (line number, row offset) does not map cleanly.`,
        ],
      },
      {
        title: 'Dynamic Row-Count Partitioning',
        body: [
          `The most robust strategy for skewed data: query the actual row count per range and create partitions with roughly equal record counts. This requires a two-pass approach — first, sample or count the data; second, build partition boundaries that balance load.`,
          `For the reconciliation domain, you can use a window function or a pre-computed histogram table to find accountId boundaries that split the ~100K transactions into ~25K chunks each. The partitioner runs this query once at job start, then emits the balanced ranges. The upfront query cost is negligible compared to the time saved by eliminating stragglers.`,
        ],
        code: `// Two-pass partitioner: count first, then balance
public class BalancedRangePartitioner implements Partitioner {

    private final DataSource dataSource;
    private final int targetRowsPerPartition;

    @Override
    public Map<String, ExecutionContext> partition(int gridSize) {
        // Pass 1: Get ordered account IDs and cumulative counts
        List<AccountCount> distribution = fetchDistribution();

        // Pass 2: Build boundaries so each partition gets ~targetRowsPerPartition
        Map<String, ExecutionContext> map = new HashMap<>();
        long currentMin = distribution.get(0).accountId();
        long currentCount = 0;
        int partitionIndex = 0;

        for (AccountCount ac : distribution) {
            currentCount += ac.count();
            if (currentCount >= targetRowsPerPartition) {
                ExecutionContext ctx = new ExecutionContext();
                ctx.putLong("minId", currentMin);
                ctx.putLong("maxId", ac.accountId());
                map.put("partition" + partitionIndex++, ctx);
                currentMin = ac.accountId() + 1;
                currentCount = 0;
            }
        }

        // Handle remainder
        if (currentCount > 0) {
            ExecutionContext ctx = new ExecutionContext();
            ctx.putLong("minId", currentMin);
            ctx.putLong("maxId", distribution.get(distribution.size() - 1).accountId());
            map.put("partition" + partitionIndex, ctx);
        }

        return map;
    }

    private List<AccountCount> fetchDistribution() {
        String sql = """
            SELECT account_id, COUNT(*) as cnt
            FROM transactions
            GROUP BY account_id
            ORDER BY account_id
            """;
        // Execute and map to AccountCount records...
        return List.of();
    }

    record AccountCount(long accountId, long count) {}
}`,
        codeLabel: 'java',
      },
      {
        title: 'Diagnosing Stragglers in Production',
        body: [
          `The <code>BATCH_STEP_EXECUTION</code> table tells the story. After a partitioned job completes, compare the <code>read_count</code>, <code>write_count</code>, and <code>duration</code> (derived from <code>start_time</code> and <code>end_time</code>) across all partition step executions. If one partition has 10x the reads and 10x the duration, you have a straggler.`,
          `Fix the partitioner, not the worker. Do not try to compensate with a faster processor or larger chunk size — the root cause is uneven data distribution. Re-run the partition query with production data volumes to validate boundary balance before deploying a new partitioner to production.`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Assuming Uniform Key Distribution:</strong> Range-based partitioning on <code>accountId</code> works beautifully in dev with 1,000 synthetic evenly-distributed records. In production with 1M records and Pareto-distributed activity, it creates catastrophic stragglers. Always test partition boundaries against production-like data distributions.`,
          `<strong>Pitfall 2 — Ignoring the Partition Query Cost:</strong> A dynamic partitioner that scans the entire table to compute balanced ranges adds startup latency. For a job that runs in 2 minutes, a 30-second partition query is acceptable. For a job that must finish in 30 seconds, the query cost may be prohibitive. Cache the distribution histogram if the data changes slowly.`,
          `<strong>Pitfall 3 — Too Many Small Partitions:</strong> Creating 100 partitions for 50K records means each partition processes ~500 items. The overhead of starting a step execution, opening a connection, and committing a transaction dwarfs the actual processing time. A good rule of thumb: each partition should process at least 5K–10K items for the overhead to amortize.`,
          `<strong>Pitfall 4 — Partition Boundaries That Overlap or Gap:</strong> Off-by-one errors in range arithmetic (<code>&lt;=</code> vs <code>&lt;</code>) cause duplicate processing (overlap) or missing records (gap). Always validate that the union of all partition ranges exactly covers the source data with no overlaps.`,
        ],
      },
    ],
    keyPoints: [
      `Range-based partitioning is simple but fails on skewed data — the straggler problem.`,
      `Modulo partitioning spreads data evenly but is hard to index and breaks restart-friendly range queries.`,
      `Dynamic row-count partitioning is the most robust: query distribution first, then build balanced boundaries.`,
      `Diagnose stragglers by comparing <code>read_count</code> and duration across <code>BATCH_STEP_EXECUTION</code> rows.`,
      `Each partition should process at least 5K–10K items to amortize step-startup overhead.`,
      `Validate that partition ranges cover all data with no overlaps or gaps.`,
    ],
    note: {
      label: 'PRODUCTION TIP',
      text: `Before deploying a new partitioner, run it in a dry-run mode that prints the computed boundaries and expected row counts per partition. Compare against actual counts before enabling the real job.`,
      tone: 'accent',
    },
    quiz: {
      question: `Your range-based partitioner splits 1M transactions into 4 equal accountId ranges. In production, Partition 0 takes 12 minutes while Partitions 1–3 each take 1 minute. What is the most effective fix?`,
      options: [
        { label: `Increase the chunk size in Partition 0 to reduce transaction overhead`, correct: false },
        { label: `Add more threads to the TaskExecutor so Partition 0 gets more CPU`, correct: false },
        { label: `Switch to a dynamic row-count partitioner that balances records per partition based on actual data distribution`, correct: true },
        { label: `Reduce gridSize to 2 so there are fewer partitions overall`, correct: false },
      ],
      explanation: `The root cause is data skew — one range contains disproportionately more records. Increasing chunk size or adding threads treats symptoms, not the cause. Reducing gridSize to 2 would create even larger stragglers. The correct fix is to measure actual row counts per key range and build partition boundaries that distribute work evenly. This is what dynamic row-count partitioning achieves.`,
    },
  },
  {
    id: '11.6',
    title: 'TaskExecutorPartitionHandler & Thread-Safety Audit',
    duration: '12 min',
    kind: 'concept',
    summary: [
      `Configuring the <code>TaskExecutorPartitionHandler</code> correctly is not just about setting a thread pool size. You must audit which beans are shared across partition threads versus isolated per partition, and understand how the handler coordinates completion. Misconfiguration here silently breaks correctness or leaves partitions hanging.`,
    ],
    topics: [
      {
        title: 'Handler Configuration Deep Dive',
        body: [
          `The <code>TaskExecutorPartitionHandler</code> has three critical properties: <code>step</code> (the worker step to execute), <code>taskExecutor</code> (the thread pool), and <code>gridSize</code> (passed to the partitioner as a hint). It also has <code>pollInterval</code>, which controls how often the handler checks the JobRepository for partition completion.`,
          `The default <code>pollInterval</code> is 10 seconds. For fast local partitions that finish in under a minute, this is sluggish — the master step may wait 10 seconds after the last partition finishes before declaring completion. For remote partitions (11.9), a longer interval reduces DB load. Tune this based on expected partition duration.`,
        ],
        code: `TaskExecutorPartitionHandler handler = new TaskExecutorPartitionHandler();
handler.setStep(workerStep());
handler.setTaskExecutor(partitionTaskExecutor());
handler.setGridSize(4);
handler.setJobRepository(jobRepository);
// Tune poll interval based on expected partition duration
handler.setPollInterval(partitionDuration < 60_000 ? 1_000 : 10_000);`,
        codeLabel: 'java',
      },
      {
        title: 'Thread-Safety Audit Checklist',
        body: [
          `Before enabling partitioning, audit every bean in the worker step for thread safety. Ask: is this bean shared across all partitions, or does each partition get its own instance?`,
          `Items marked with <code>@StepScope</code> are safe — each partition gets its own. Singleton beans are shared and must be stateless or thread-safe. The most commonly overlooked shared beans are: <code>ItemProcessor</code> (often stateless, but watch for caches), <code>ItemWriter</code> (JDBC batch writers are usually fine; custom writers need audit), and any service beans injected into processors (e.g., a REST client with connection pooling).`,
        ],
        diagram: `<div class="diagram-caption">Bean Scope Audit: Shared vs Isolated</div><div class="dg-flow"><div class="dg-workers"><div class="dg-worker"><div class="dg-worker-label">Partition 0</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--green">@StepScope Reader</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box dg-box--green">@StepScope Writer</div></div><div class="dg-box-sub">ISOLATED — own instance</div></div><div class="dg-worker"><div class="dg-worker-label">Partition 1</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--green">@StepScope Reader</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box dg-box--green">@StepScope Writer</div></div><div class="dg-box-sub">ISOLATED — own instance</div></div></div><div class="dg-pipe" style="margin-top:1rem"><div class="dg-box dg-box--red"><div class="dg-box-title">Singleton Service Bean</div><div class="dg-box-sub">SHARED across all partitions · must be thread-safe</div></div><div class="dg-arrow"><span>→</span><small>injected into</small></div><div class="dg-box dg-box--dim"><div class="dg-box-title">All Processors</div><div class="dg-box-sub">concurrent access · audit for mutable state</div></div></div></div>`,
      },
      {
        title: 'The gridSize vs Pool Size Trap',
        body: [
          `If <code>gridSize</code> exceeds the thread pool's maximum size, excess partitions queue up. This is not a bug — the handler submits all partitions to the executor, and the executor's queue holds the backlog. However, if the queue is unbounded, you risk memory exhaustion. If the queue is bounded with a rejection policy like <code>CallerRunsPolicy</code>, the master thread itself may run a partition, blocking further dispatch.`,
          `Best practice: set <code>corePoolSize = maxPoolSize = gridSize</code> and <code>queueCapacity = 0</code> (direct handoff). This ensures every partition gets a thread immediately, with no queueing. If you need backpressure, use a small bounded queue and a <code>RejectedExecutionException</code> policy that fails the job fast rather than silently degrading.`,
        ],
        code: `// RECOMMENDED: Direct handoff — one thread per partition, no queue
@Bean
public TaskExecutor partitionTaskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(4);   // = gridSize
    executor.setMaxPoolSize(4);    // = gridSize
    executor.setQueueCapacity(0);  // Direct handoff — SynchronousQueue
    executor.setThreadNamePrefix("partition-");
    executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
    executor.initialize();
    return executor;
}`,
        codeLabel: 'java',
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Stateful Singleton Processor:</strong> A processor that caches lookup results in a <code>HashMap</code> for "performance" will have race conditions across partitions. Use <code>ConcurrentHashMap</code> if caching is truly needed, or better, move the cache to a separate <code>@StepScope</code> bean so each partition has its own.`,
          `<strong>Pitfall 2 — Forgetting setJobRepository on Handler:</strong> Without this, the handler cannot query <code>BATCH_STEP_EXECUTION</code> to detect completion. The master step hangs indefinitely, polling a repository it cannot access.`,
          `<strong>Pitfall 3 — Unbounded Queue with Large gridSize:</strong> A <code>LinkedBlockingQueue</code> with default capacity (Integer.MAX_VALUE) and <code>gridSize=100</code> means 100 partition tasks sit in memory. If each task holds a reference to a large <code>ExecutionContext</code>, you can OOM before any processing begins.`,
          `<strong>Pitfall 4 — Mixing Partitioning with taskExecutor() on Worker Step:</strong> If the worker step itself has <code>.taskExecutor()</code> configured, you get nested concurrency: the partition handler dispatches to N threads, and each worker step dispatches chunks to M threads. This creates N×M concurrent chunks, easily overwhelming the database connection pool. Choose one level of parallelism, not both.`,
        ],
      },
    ],
    keyPoints: [
      `Audit every bean in the worker step for whether it is shared (singleton) or isolated (@StepScope).`,
      `Set <code>pollInterval</code> based on expected partition duration — shorter for fast local partitions.`,
      `Align <code>gridSize</code> with <code>corePoolSize = maxPoolSize</code> and use <code>queueCapacity=0</code> for direct handoff.`,
      `Never forget <code>setJobRepository()</code> on the <code>TaskExecutorPartitionHandler</code>.`,
      `Do not combine partitioning with <code>taskExecutor()</code> on the worker step — nested parallelism overwhelms resources.`,
      `Validate that singleton service beans injected into processors are stateless or thread-safe.`,
    ],
    note: {
      label: 'AUDIT CHECKLIST',
      text: `Before enabling partitioning, list every bean in the worker step. Mark each as @StepScope (safe) or singleton (needs audit). Any singleton with mutable state is a bug waiting to happen.`,
      tone: 'accent',
    },
    quiz: {
      question: `You configure a partitioned step with <code>gridSize=8</code> and a <code>ThreadPoolTaskExecutor</code> with <code>corePoolSize=8</code>, <code>maxPoolSize=8</code>, and <code>queueCapacity=100</code>. During load testing, you notice partitions finish quickly but the master step takes an extra 10+ seconds to declare completion. What is the likely cause?`,
      options: [
        { label: `The worker step is too slow and needs a larger chunk size`, correct: false },
        { label: `The pollInterval on TaskExecutorPartitionHandler is too long relative to partition duration`, correct: true },
        { label: `The queue capacity is too large, causing partitions to wait too long`, correct: false },
        { label: `The gridSize is too high, creating too much overhead`, correct: false },
      ],
      explanation: `With corePoolSize=maxPoolSize=8 and gridSize=8, all partitions run immediately (no queueing). The delay is in the master step's completion detection. TaskExecutorPartitionHandler polls the JobRepository at pollInterval to check if partitions are done. If pollInterval is 10 seconds (the default) and partitions finish in 2 seconds, the master may wait up to 10 seconds after the last partition before noticing. Reducing pollInterval to 1 second fixes this.`,
    },
  },
  {
    id: '11.7',
    title: 'Java 21 Virtual Threads for Batch',
    duration: '10 min',
    kind: 'concept',
    summary: [
      `Java 21's virtual threads (Project Loom) offer a compelling model for I/O-bound batch steps: millions of lightweight threads with near-zero context-switch cost. Spring Batch 5.2 supports virtual threads via <code>SimpleAsyncTaskExecutor.setVirtualThreads(true)</code>. But the benefit is not automatic — it depends on what your step actually does.`,
    ],
    topics: [
      {
        title: 'When Virtual Threads Help',
        body: [
          `Virtual threads shine when your step spends most of its time waiting: database queries, REST API calls, file I/O. A platform thread blocked on a socket read holds an OS thread; a virtual thread blocked on the same read is parked by the JVM and the carrier thread moves on. For a reconciliation step that enriches each transaction via a REST lookup to a legacy system, virtual threads can saturate the network without exhausting the OS thread pool.`,
          `For CPU-bound steps — heavy mathematical computation, complex validation rules — virtual threads provide no benefit. The work is compute-limited, not thread-limited. Adding more virtual threads than CPU cores just increases scheduling overhead without improving throughput.`,
        ],
        diagram: `<div class="diagram-caption">Virtual Threads: I/O-Bound vs CPU-Bound</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">I/O-Bound Step (Benefits)</div><div class="dg-pipe"><div class="dg-box dg-box--green"><div class="dg-box-title">Virtual Thread</div><div class="dg-box-sub">blocked on DB query</div></div><div class="dg-arrow"><span>⇄</span><small>parked</small></div><div class="dg-box dg-box--accent"><div class="dg-box-title">Carrier Thread</div><div class="dg-box-sub">switches to next virtual thread</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--green"><div class="dg-box-title">Virtual Thread</div><div class="dg-box-sub">makes REST call</div></div></div></div><div class="dg-thread"><div class="dg-thread-label">CPU-Bound Step (No Benefit)</div><div class="dg-pipe"><div class="dg-box dg-box--red"><div class="dg-box-title">Virtual Thread</div><div class="dg-box-sub">100% CPU on validation</div></div><div class="dg-arrow"><span>→</span><small>no parking</small></div><div class="dg-box dg-box--red"><div class="dg-box-title">Virtual Thread</div><div class="dg-box-sub">100% CPU on computation</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--dim"><div class="dg-box-title">Throughput</div><div class="dg-box-sub">same as platform threads</div></div></div></div></div>`,
      },
      {
        title: 'Configuring Virtual Threads in Spring Batch',
        body: [
          `Spring Batch 5.2 integrates with virtual threads through <code>SimpleAsyncTaskExecutor</code>. Set <code>setVirtualThreads(true)</code> and the executor creates a new virtual thread for each task instead of submitting to a platform thread pool. There is no <code>corePoolSize</code> or <code>maxPoolSize</code> to tune — virtual threads are cheap enough that one per task is fine.`,
          `Use this for the <code>TaskExecutorPartitionHandler</code> in local partitioning, or for <code>.taskExecutor()</code> in multi-threaded steps. Do not use virtual threads for remote partitioning (11.9) — the message broker worker threads are platform threads managed by the broker client, not by Spring's task executor.`,
        ],
        code: `package com.example.reconciliation.batch;

import org.springframework.batch.core.partition.support.TaskExecutorPartitionHandler;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.core.task.SimpleAsyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class VirtualThreadPartitionConfig {

    @Bean
    public TaskExecutor virtualThreadExecutor() {
        SimpleAsyncTaskExecutor executor = new SimpleAsyncTaskExecutor("batch-vt-");
        executor.setVirtualThreads(true);  // Java 21+ only
        return executor;
    }

    // Use in TaskExecutorPartitionHandler for local partitioning
    public TaskExecutorPartitionHandler partitionHandler() {
        TaskExecutorPartitionHandler handler = new TaskExecutorPartitionHandler();
        handler.setTaskExecutor(virtualThreadExecutor());
        handler.setGridSize(100);  // Can be much larger than platform thread limits
        // ... other config
        return handler;
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'The Synchronized Block Pinning Caveat',
        body: [
          `Virtual threads are pinned to their carrier thread when they execute a <code>synchronized</code> block or method, or when they call a native method. If your batch code uses <code>synchronized</code> for thread safety — for example, inside <code>SynchronizedItemStreamReader</code> — the virtual thread cannot be unmounted during the synchronized section.`,
          `In practice, this means <code>SynchronizedItemStreamReader</code> with virtual threads still serializes reads, and the virtual thread is pinned during each read. The impact is usually minor for short reads, but for long-running synchronized operations (e.g., a synchronized block around a slow database call), you lose the main benefit of virtual threads. Monitor with <code>jcmd &lt;pid&gt; Thread.dump_to_file</code> to detect pinning.`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Using Virtual Threads for CPU-Bound Work:</strong> Expecting virtual threads to speed up a step that is pure computation is a misconception. Profile first: if CPU is at 100% with platform threads, virtual threads will not help.`,
          `<strong>Pitfall 2 — Pinning from synchronized Blocks:</strong> If your code or a library you use has synchronized blocks, virtual threads pin to carrier threads. In Spring Batch 5.2, <code>SynchronizedItemStreamReader</code> uses synchronized — this is acceptable for short reads but problematic if the underlying reader is slow. Check your JDK version: pinning behavior improved in later Java 21 updates.`,
          `<strong>Pitfall 3 — Unbounded Virtual Thread Creation:</strong> <code>SimpleAsyncTaskExecutor</code> with virtual threads creates one virtual thread per task with no upper limit. For a partitioned job with <code>gridSize=10,000</code>, you get 10,000 virtual threads. They are lightweight, but the <code>ExecutionContext</code> objects and step metadata for 10,000 partitions consume significant memory. Start with a reasonable gridSize (under 100) and scale up based on measurement.`,
          `<strong>Pitfall 4 — Virtual Threads with Remote Partitioning:</strong> Virtual threads are a JVM-level construct. Remote partitioning workers run in separate JVMs, and the message broker (JMS/Kafka) manages its own consumer threads. Virtual threads on the manager node do not affect worker throughput. Use virtual threads for local partitioning and multi-threaded steps only.`,
        ],
      },
    ],
    keyPoints: [
      `Virtual threads benefit I/O-bound steps (DB, REST, file I/O) where threads spend most of their time waiting.`,
      `CPU-bound steps see no throughput improvement from virtual threads.`,
      `Configure via <code>SimpleAsyncTaskExecutor.setVirtualThreads(true)</code> — no pool size tuning needed.`,
      `Synchronized blocks pin virtual threads to carrier threads; verify pinning behavior on your exact JDK version.`,
      `Virtual threads are for local concurrency only — they do not apply to remote partitioning workers.`,
      `Start with a conservative gridSize and scale up; unbounded virtual threads still consume memory for metadata.`,
    ],
    note: {
      label: 'VERSION NOTE',
      text: `Virtual thread pinning behavior has improved across Java 21 updates. Early releases pinned on all synchronized blocks; later updates reduce pinning. Verify your exact JDK version before production deployment.`,
      tone: 'accent',
    },
    quiz: {
      question: `You have a partitioned reconciliation step where each partition makes 3 REST API calls per item to enrich transaction data. The database reads are fast, but the REST calls average 200ms each. Would virtual threads improve throughput?`,
      options: [
        { label: `No — virtual threads only help with database I/O, not REST calls`, correct: false },
        { label: `Yes — the step is I/O-bound on REST latency, so virtual threads allow more concurrent requests without exhausting OS threads`, correct: true },
        { label: `Only if the REST client uses asynchronous/non-blocking APIs`, correct: false },
        { label: `No — the synchronized blocks in SynchronizedItemStreamReader prevent any benefit`, correct: false },
      ],
      explanation: `The step is I/O-bound: 3 × 200ms = 600ms of waiting per item, with fast DB reads. Virtual threads excel here because they park during blocking REST calls, allowing the carrier thread to run other virtual threads. The REST client does not need to be async — virtual threads make blocking calls efficient by unmounting. SynchronizedItemStreamReader pins briefly during reads, but since DB reads are fast, the pinning overhead is negligible compared to the 600ms REST wait time.`,
    },
  },
  {
    id: '11.8',
    title: 'StepExecutionAggregator',
    duration: '10 min',
    kind: 'concept',
    summary: [
      `When all partitions finish, the master step needs to determine its final status. The <code>StepExecutionAggregator</code> rolls up per-partition results into a single master <code>StepExecution</code>. Understanding this rollup is essential for correct job flow control and restart behavior.`,
    ],
    topics: [
      {
        title: 'How Aggregation Works',
        body: [
          `The default aggregator is <code>DefaultStepExecutionAggregator</code>. It iterates over all partition <code>StepExecution</code> objects and: (1) sums <code>readCount</code>, <code>writeCount</code>, <code>commitCount</code>, <code>skipCount</code>, and <code>rollbackCount</code>; (2) sets the master step's <code>ExitStatus</code> to the most severe status among partitions (FAILED beats COMPLETED, which beats STARTING); (3) sets the master step's <code>BatchStatus</code> to FAILED if any partition failed.`,
          `This means one failed partition fails the entire master step by default. This is usually the correct behavior for financial reconciliation — partial success is not success. However, you can customize the aggregator if your domain allows partial completion (e.g., process what you can and flag the rest for manual review).`,
        ],
        diagram: `<div class="diagram-caption">StepExecutionAggregator: Rolling Up Partition Results</div><div class="dg-flow"><div class="dg-workers"><div class="dg-worker"><div class="dg-worker-label">Partition 0</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--green">COMPLETED</div></div><div class="dg-box-sub">read=25K · write=25K</div></div><div class="dg-worker"><div class="dg-worker-label">Partition 1</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--green">COMPLETED</div></div><div class="dg-box-sub">read=25K · write=25K</div></div><div class="dg-worker"><div class="dg-worker-label">Partition 2</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--red">FAILED</div></div><div class="dg-box-sub">read=10K · write=0 · Exception</div></div><div class="dg-worker"><div class="dg-worker-label">Partition 3</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--green">COMPLETED</div></div><div class="dg-box-sub">read=25K · write=25K</div></div></div><div class="dg-arrow" style="margin:1rem 0"><span>↓</span><small>aggregates to</small></div><div class="dg-repo"><div class="dg-box dg-box--red"><div class="dg-box-title">Master StepExecution</div><div class="dg-box-sub">BatchStatus=FAILED · ExitStatus=FAILED · read=85K · write=75K</div></div></div></div>`,
      },
      {
        title: 'Customizing the Aggregator',
        body: [
          `To implement a custom aggregator, implement <code>StepExecutionAggregator</code> and override <code>aggregate(StepExecution, Collection&lt;StepExecution&gt;)</code>. A common use case in reconciliation is "tolerance-based" aggregation: fail the master step only if more than N% of partitions failed, or if the total skipped record count exceeds a threshold.`,
          `Be careful: customizing the aggregator changes what downstream flow control (12.1) sees. If your aggregator returns COMPLETED despite a failed partition, the next step in the job flow will run, potentially on incomplete data. Document this behavior clearly and ensure stakeholders understand the tolerance policy.`,
        ],
        code: `package com.example.reconciliation.batch;

import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.partition.support.StepExecutionAggregator;
import org.springframework.stereotype.Component;

import java.util.Collection;

@Component
public class TolerantStepExecutionAggregator implements StepExecutionAggregator {

    private static final double MAX_FAILURE_RATE = 0.25;  // Allow up to 25% partition failure

    @Override
    public void aggregate(StepExecution masterStepExecution, Collection<StepExecution> partitionStepExecutions) {
        long totalRead = 0;
        long totalWrite = 0;
        int failedPartitions = 0;
        int totalPartitions = partitionStepExecutions.size();

        for (StepExecution se : partitionStepExecutions) {
            totalRead += se.getReadCount();
            totalWrite += se.getWriteCount();
            if (se.getStatus().isUnsuccessful()) {
                failedPartitions++;
            }
        }

        double failureRate = (double) failedPartitions / totalPartitions;
        masterStepExecution.setReadCount(totalRead);
        masterStepExecution.setWriteCount(totalWrite);

        if (failureRate > MAX_FAILURE_RATE) {
            masterStepExecution.setStatus(BatchStatus.FAILED);
            masterStepExecution.setExitStatus(ExitStatus.FAILED);
        } else if (failedPartitions > 0) {
            masterStepExecution.setStatus(BatchStatus.COMPLETED);
            masterStepExecution.setExitStatus(new ExitStatus("COMPLETED_WITH_WARNINGS",
                String.format("%d of %d partitions failed", failedPartitions, totalPartitions)));
        } else {
            masterStepExecution.setStatus(BatchStatus.COMPLETED);
            masterStepExecution.setExitStatus(ExitStatus.COMPLETED);
        }
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'Restart After Partial Failure',
        body: [
          `When a partitioned job is restarted after a failure, Spring Batch restarts only the failed partitions — not the successful ones. This is possible because each partition has its own <code>StepExecution</code> with its own <code>ExecutionContext</code> storing restart position. The master step re-runs the partitioner, but the framework recognizes which partitions already completed and skips them.`,
          `This per-partition restart granularity is a major advantage over multi-threaded steps (11.2), where a failure forces restart from the last committed chunk of the single shared step execution. With partitioning, a crash in Partition 2 does not re-process Partitions 0 and 1.`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Assuming Aggregator Affects Restart:</strong> The aggregator only affects the master step's final status for flow control. It does not change which partitions restart. Even if a custom aggregator marks the master as COMPLETED, a restart still re-runs failed partitions because their individual <code>StepExecution</code> status remains FAILED in the JobRepository.`,
          `<strong>Pitfall 2 — Tolerance Policies Without Monitoring:</strong> A tolerant aggregator that allows 25% partition failure without failing the job masks data quality issues. If partitions fail consistently for the same data range, you are silently accumulating unreconciled transactions. Always alert on any partition failure, even if the job completes.`,
          `<strong>Pitfall 3 — Forgetting to Wire the Custom Aggregator:</strong> A custom aggregator bean must be explicitly set on the <code>TaskExecutorPartitionHandler</code> (or <code>MessageChannelPartitionHandler</code> for remote). Without <code>handler.setStepExecutionAggregator(myAggregator)</code>, the default aggregator is used and your tolerance logic is ignored.`,
          `<strong>Pitfall 4 — Aggregating Non-Numeric ExitStatus:</strong> If partitions return custom <code>ExitStatus</code> strings (e.g., "COMPLETED_WITH_DUPLICATES"), the default aggregator compares them lexicographically, which may not match your business severity. Use a custom aggregator with explicit severity ordering.`,
        ],
      },
    ],
    keyPoints: [
      `The default aggregator sums counts and sets the master status to FAILED if any partition failed.`,
      `One failed partition fails the master step by default — customize the aggregator if your domain needs tolerance.`,
      `Restart after failure re-runs only failed partitions, not the entire job — per-partition granularity.`,
      `Custom aggregators must be explicitly wired to the partition handler; they do not auto-detect.`,
      `Tolerance policies should always be paired with alerting — silent partial failures hide data quality issues.`,
      `The aggregator affects flow control (12.1) but not restart semantics — failed partitions always restart.`,
    ],
    note: {
      label: 'DESIGN DECISION',
      text: `For financial reconciliation, the default aggregator (fail on any partition failure) is usually correct. Partial settlement is worse than no settlement — it gives a false sense of completeness. Only customize after explicit business sign-off.`,
      tone: 'accent',
    },
    quiz: {
      question: `A partitioned reconciliation job has 4 partitions. Partition 2 fails with a database connection timeout. The other 3 partitions complete successfully. The job is restarted. What happens?`,
      options: [
        { label: `All 4 partitions restart from the beginning`, correct: false },
        { label: `Only Partition 2 restarts; the other 3 are skipped because their StepExecution status is COMPLETED`, correct: true },
        { label: `The master step restarts but dispatches no partitions because the aggregator marked the job COMPLETED`, correct: false },
        { label: `The job cannot be restarted because partitioned jobs do not support restart`, correct: false },
      ],
      explanation: `Spring Batch tracks each partition's StepExecution independently in the JobRepository. On restart, the framework checks the status of each partition's prior StepExecution. Partitions with COMPLETED status are skipped; only FAILED partitions are re-dispatched. This is a core benefit of partitioning over multi-threaded steps, which have a single StepExecution and must restart from the last committed chunk of the whole step.`,
    },
  },
  {
    id: '11.9',
    title: 'Architecture 3: Remote Partitioning — MessageChannelPartitionHandler',
    duration: '16 min',
    kind: 'concept',
    summary: [
      `Remote partitioning distributes partitions across multiple JVMs via a message broker. The manager JVM runs the partitioner and dispatches partition requests; worker JVMs poll for work, execute their assigned partition, and reply with results. This is the architecture for scaling beyond a single machine's CPU and memory limits.`,
    ],
    topics: [
      {
        title: 'The Remote Partitioning Flow',
        body: [
          `Unlike local partitioning (11.4) where the <code>TaskExecutorPartitionHandler</code> dispatches to threads in the same JVM, remote partitioning uses <code>MessageChannelPartitionHandler</code>. The manager sends partition requests as messages to a request queue/topic. Worker JVMs consume these messages, deserialize the <code>ExecutionContext</code>, and execute the worker step locally. When done, they send a reply message back to a reply queue/topic.`,
          `The manager polls the JobRepository via <code>JobExplorer</code> at <code>pollInterval</code> to detect when partitions complete. This is pull-based, not push-based: the manager does not wait on a reply message directly. Instead, it queries <code>BATCH_STEP_EXECUTION</code> for step executions matching its <code>StepExecution</code> split. This design decouples the manager from worker lifecycle — workers can crash and restart without the manager knowing why.`,
        ],
        diagram: `<div class="diagram-caption">Remote Partitioning: Manager → Broker → Workers</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">Manager JVM</div><div class="dg-pipe"><div class="dg-box dg-box--accent"><div class="dg-box-title">Partitioner</div><div class="dg-box-sub">creates ExecutionContexts</div></div><div class="dg-arrow"><span>→</span><small>send</small></div><div class="dg-box dg-box--green"><div class="dg-box-title">MessageChannelPartitionHandler</div><div class="dg-box-sub">pollInterval=10s · polls JobRepository</div></div></div></div><div class="dg-arrow" style="margin:0.5rem 0"><span>↓</span><small>request messages</small></div><div class="dg-thread"><div class="dg-thread-label">Message Broker</div><div class="dg-pipe"><div class="dg-box dg-box--dim"><div class="dg-box-title">Request Queue/Topic</div><div class="dg-box-sub">partition0, partition1, ...</div></div><div class="dg-arrow"><span>↔</span></div><div class="dg-box dg-box--dim"><div class="dg-box-title">Reply Queue/Topic</div><div class="dg-box-sub">worker results</div></div></div></div><div class="dg-arrow" style="margin:0.5rem 0"><span>↑</span><small>reply messages</small></div><div class="dg-workers"><div class="dg-worker"><div class="dg-worker-label">Worker JVM 1</div><div class="dg-worker-steps"><div class="dg-mini-box">Consume</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Execute</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Reply</div></div></div><div class="dg-worker"><div class="dg-worker-label">Worker JVM 2</div><div class="dg-worker-steps"><div class="dg-mini-box">Consume</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Execute</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Reply</div></div></div><div class="dg-worker dg-box--dim"><div class="dg-worker-label">Worker JVM N</div><div class="dg-worker-steps"><div class="dg-mini-box">Consume</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Execute</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Reply</div></div></div></div></div>`,
      },
      {
        title: 'Manager Configuration',
        body: [
          `The manager side configures a <code>MessageChannelPartitionHandler</code> with a <code>MessagingTemplate</code> for sending requests and a <code>pollInterval</code>. The <code>replyChannel</code> is where the manager listens for completion signals, but as noted, the actual completion detection is JobRepository polling — the reply channel primarily triggers the poll sooner.`,
          `The manager does not need the worker step beans in its context — it only needs the <code>Partitioner</code> and the handler. The worker JVMs contain the actual <code>ItemReader</code>, <code>ItemProcessor</code>, and <code>ItemWriter</code> beans. This separation means the manager JVM can be lightweight, while worker JVMs carry the heavy processing dependencies.`,
        ],
        code: `package com.example.reconciliation.batch.remote;

import org.springframework.batch.core.Step;
import org.springframework.batch.core.configuration.annotation.StepScope;
import org.springframework.batch.core.explore.JobExplorer;
import org.springframework.batch.core.partition.support.Partitioner;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.integration.partition.MessageChannelPartitionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.core.MessagingTemplate;
import org.springframework.messaging.MessageChannel;

@Configuration
public class RemotePartitioningManagerConfig {

    private final JobRepository jobRepository;
    private final JobExplorer jobExplorer;

    public RemotePartitioningManagerConfig(JobRepository jobRepository, JobExplorer jobExplorer) {
        this.jobRepository = jobRepository;
        this.jobExplorer = jobExplorer;
    }

    @Bean
    public MessageChannel requestsChannel() {
        return new DirectChannel();
    }

    @Bean
    public MessageChannel repliesChannel() {
        return new DirectChannel();
    }

    @Bean
    public MessageChannelPartitionHandler partitionHandler() {
        MessageChannelPartitionHandler handler = new MessageChannelPartitionHandler();
        handler.setStepName("workerStep");
        handler.setGridSize(4);
        handler.setJobRepository(jobRepository);
        handler.setJobExplorer(jobExplorer);
        handler.setMessagingOperations(messagingTemplate());
        handler.setReplyChannel(repliesChannel());
        // Poll interval: trade-off between latency and DB load
        handler.setPollInterval(10_000);
        return handler;
    }

    @Bean
    public MessagingTemplate messagingTemplate() {
        MessagingTemplate template = new MessagingTemplate();
        template.setDefaultChannel(requestsChannel());
        return template;
    }

    @Bean
    public Step masterStep(Partitioner partitioner) {
        return new StepBuilder("masterStep", jobRepository)
                .partitioner("workerStep", partitioner)
                .partitionHandler(partitionHandler())
                .build();
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'Worker Configuration',
        body: [
          `Worker JVMs use Spring Integration's <code>@ServiceActivator</code> to consume partition request messages. Each message contains a <code>StepExecutionRequest</code> with the partition's <code>StepExecution</code> ID. The worker looks up the step execution from the shared JobRepository, executes the worker step, and updates the step execution status.`,
          `The worker JVM must have access to the same <code>JobRepository</code> database as the manager — this is how the manager polls for completion. The worker also needs the worker step definition, including all <code>@StepScope</code> beans. The worker does not run the full job; it only executes the single step assigned to it.`,
        ],
        code: `package com.example.reconciliation.batch.remote;

import org.springframework.batch.core.Step;
import org.springframework.batch.integration.partition.StepExecutionRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.annotation.MessagingGateway;
import org.springframework.messaging.handler.annotation.Header;

@Configuration
public class RemotePartitioningWorkerConfig {

    private final Step workerStep;

    public RemotePartitioningWorkerConfig(Step workerStep) {
        this.workerStep = workerStep;
    }

    // Worker consumes partition requests and executes the step
    @ServiceActivator(inputChannel = "requestsChannel")
    public void handlePartitionRequest(StepExecutionRequest request) throws Exception {
        // The StepExecutionRequest contains the step execution ID
        // Spring Batch Integration handles the lookup and execution
        // This is typically wired via Spring Batch Integration's
        // RemotePartitioningWorkerStepBuilder or similar abstraction
        // Full wiring depends on broker choice (JMS/AMQP/Kafka)
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'The Poll Interval Trade-Off',
        body: [
          `The manager polls the JobRepository at <code>pollInterval</code> to check partition status. This is not a busy-wait on the message broker — it is a database query against <code>BATCH_STEP_EXECUTION</code>. A short interval (1 second) gives fast completion detection but increases DB load, especially with many concurrent manager jobs. A long interval (30 seconds) reduces DB load but extends total job latency.`,
          `For a nightly reconciliation job where total runtime is 30 minutes, a 10-second poll interval adds negligible overhead. For a high-frequency job that must complete in 2 minutes, a 1-second interval is justified. Monitor DB connection usage from the manager — if it is a significant load, consider caching or a longer interval.`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Manager and Worker JobRepository Mismatch:</strong> If the manager and workers point to different databases, the manager polls a JobRepository that never sees the workers' updates. The job hangs indefinitely. Both must share the same <code>BATCH_STEP_EXECUTION</code> table.`,
          `<strong>Pitfall 2 — Forgetting replyChannel Configuration:</strong> Without a reply channel, the manager has no trigger to poll early. It still works (polls at interval), but completion detection is delayed by up to one poll interval. Configure a reply channel for faster feedback.`,
          `<strong>Pitfall 3 — Worker JVM Missing Step Definition:</strong> Workers need the full worker step bean graph — reader, processor, writer, and any dependencies. If the worker JVM context does not include these beans, it fails with <code>NoSuchBeanDefinitionException</code> when processing the first partition message.`,
          `<strong>Pitfall 4 — Network Partition Between Manager and Broker:</strong> If the manager cannot reach the broker, partition requests queue in memory or fail immediately depending on the messaging template configuration. Use a persistent broker (not in-memory) and configure message durability so requests survive a manager restart.`,
        ],
      },
    ],
    keyPoints: [
      `Remote partitioning uses <code>MessageChannelPartitionHandler</code> to dispatch partitions across JVMs via a message broker.`,
      `The manager polls the shared JobRepository (not the broker) to detect partition completion.`,
      `Workers execute the worker step locally and update the shared JobRepository for the manager to discover.`,
      `Manager and workers must share the same JobRepository database — this is non-negotiable.`,
      `<code>pollInterval</code> is a latency-vs-DB-load tradeoff; tune based on job duration and frequency.`,
      `Worker JVMs need the full worker step bean graph, including all @StepScope components.`,
    ],
    note: {
      label: 'ARCHITECTURE NOTE',
      text: `Remote partitioning is the first architecture in this course that introduces a distributed system. Every distributed system failure mode — network partitions, broker unavailability, serialization mismatches, clock skew — now applies. Do not adopt this architecture unless your team already operates the broker infrastructure.`,
      tone: 'accent',
    },
    quiz: {
      question: `In a remote partitioning setup, the manager sends partition requests to a Kafka topic. Workers consume and execute partitions, but the manager step hangs for hours even though all workers finished successfully. What is the most likely cause?`,
      options: [
        { label: `The Kafka topic has no consumers, so messages are never processed`, correct: false },
        { label: `The manager and workers are using different JobRepository databases`, correct: true },
        { label: `The pollInterval is set too high, causing a minor delay`, correct: false },
        { label: `The workers did not send reply messages to the reply topic`, correct: false },
      ],
      explanation: `The manager detects completion by polling the JobRepository, not by waiting on reply messages. If workers update a different database than the manager polls, the manager never sees COMPLETED status. This is the #1 remote partitioning misconfiguration. Even with correct reply messages, the manager would still hang because it queries the wrong JobRepository.`,
    },
  },
  {
    id: '11.10',
    title: 'Serialization Requirements',
    duration: '10 min',
    kind: 'concept',
    summary: [
      `Remote partitioning sends <code>StepExecution</code> and <code>ExecutionContext</code> objects over the wire. Every object in this graph must be <code>Serializable</code>. A single non-serializable field — a <code>DataSource</code> reference, a custom domain object, a closure — breaks the entire architecture at runtime.`,
    ],
    topics: [
      {
        title: 'What Must Be Serializable',
        body: [
          `The <code>StepExecution</code> object contains a reference to its <code>ExecutionContext</code>, which is a map of key-value pairs. When the manager sends a partition request, it serializes the <code>StepExecution</code> (or a lightweight request containing the step execution ID and context). The worker deserializes it to reconstruct the partition's state.`,
          `Spring Batch's built-in <code>ExecutionContext</code> is serializable, and its standard types (<code>String</code>, <code>Long</code>, <code>Integer</code>, <code>Double</code>, <code>Date</code>, arrays and collections of these) are serializable. The danger is custom objects you place in the context via <code>ctx.put("myKey", myObject)</code>.`,
        ],
        diagram: `<div class="diagram-caption">Serialization Chain: What Travels Over the Wire</div><div class="dg-flow"><div class="dg-pipe"><div class="dg-box dg-box--accent"><div class="dg-box-title">StepExecutionRequest</div><div class="dg-box-sub">Serializable wrapper</div></div><div class="dg-arrow"><span>→</span><small>contains</small></div><div class="dg-box dg-box--green"><div class="dg-box-title">StepExecution</div><div class="dg-box-sub">Serializable · framework class</div></div><div class="dg-arrow"><span>→</span><small>contains</small></div><div class="dg-box dg-box--green"><div class="dg-box-title">ExecutionContext</div><div class="dg-box-sub">Serializable · framework class</div></div><div class="dg-arrow"><span>→</span><small>contains</small></div><div class="dg-box dg-box--red"><div class="dg-box-title">Your Custom Values</div><div class="dg-box-sub">MUST implement Serializable</div></div></div></div>`,
      },
      {
        title: 'The Non-Serializable Field Trap',
        body: [
          `A common mistake is putting a Spring-managed bean or a database connection into the <code>ExecutionContext</code>. These are never serializable. Even if you only put primitives in the context, check transitive references: a custom value object that contains a <code>DataSource</code> field, or a lambda that captures a non-serializable outer variable, will fail.`,
          `The failure mode is a <code>NotSerializableException</code> at the exact moment the manager tries to send the partition request. This happens after the partitioner runs but before any worker sees the message — making it a startup failure that is easy to miss in unit tests that only test the partitioner logic locally.`,
        ],
        code: `// WRONG: Non-serializable objects in ExecutionContext
public class BrokenPartitioner implements Partitioner {
    @Override
    public Map<String, ExecutionContext> partition(int gridSize) {
        Map<String, ExecutionContext> map = new HashMap<>();
        ExecutionContext ctx = new ExecutionContext();
        // These will all throw NotSerializableException
        ctx.put("dataSource", dataSource);
        ctx.put("jdbcTemplate", jdbcTemplate);
        ctx.put("restClient", restClient);  // HTTP client with connection pool
        ctx.put("config", new PartitionConfig());  // forgot implements Serializable!
        map.put("partition0", ctx);
        return map;
    }
}

// CORRECT: Only serializable primitives and value objects
public class SafePartitioner implements Partitioner {
    @Override
    public Map<String, ExecutionContext> partition(int gridSize) {
        Map<String, ExecutionContext> map = new HashMap<>();
        for (int i = 0; i < gridSize; i++) {
            ExecutionContext ctx = new ExecutionContext();
            ctx.putLong("minId", i * 1000L);
            ctx.putLong("maxId", (i + 1) * 1000L - 1);
            ctx.putString("partitionName", "partition" + i);
            ctx.putInt("retryCount", 3);  // Integer is serializable
            map.put("partition" + i, ctx);
        }
        return map;
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'Testing Serialization Before Deployment',
        body: [
          `Add a serialization test to your partitioner unit tests: create the partition map, serialize each <code>ExecutionContext</code> to a <code>ByteArrayOutputStream</code> via <code>ObjectOutputStream</code>, then deserialize it. This catches non-serializable fields before they fail in production.`,
          `Also test that deserialized contexts contain the expected values. A class that implements <code>Serializable</code> but has a <code>transient</code> field will deserialize with that field as <code>null</code>, which may silently break your reader configuration if the field is a required bound parameter.`,
        ],
        code: `@Test
void partitionContextsMustBeSerializable() throws Exception {
    Partitioner partitioner = new AccountIdRangePartitioner(dataSource);
    Map<String, ExecutionContext> partitions = partitioner.partition(4);

    for (Map.Entry<String, ExecutionContext> entry : partitions.entrySet()) {
        // Serialize
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ObjectOutputStream oos = new ObjectOutputStream(baos)) {
            oos.writeObject(entry.getValue());
        }

        // Deserialize
        ByteArrayInputStream bais = new ByteArrayInputStream(baos.toByteArray());
        ExecutionContext deserialized;
        try (ObjectInputStream ois = new ObjectInputStream(bais)) {
            deserialized = (ExecutionContext) ois.readObject();
        }

        // Verify values survive round-trip
        assertThat(deserialized.getLong("minId"))
            .isEqualTo(entry.getValue().getLong("minId"));
        assertThat(deserialized.getLong("maxId"))
            .isEqualTo(entry.getValue().getLong("maxId"));
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Lambdas and Anonymous Classes:</strong> A lambda assigned to a <code>Serializable</code> functional interface may capture non-serializable variables from its enclosing scope. The lambda itself serializes, but its captured state does not. Avoid lambdas in partition context values.`,
          `<strong>Pitfall 2 — Third-Party Library Objects:</strong> A <code>DateTimeFormatter</code>, <code>ZoneId</code>, or custom config object from a library may not implement <code>Serializable</code>. Convert to <code>String</code> before putting in the context.`,
          `<strong>Pitfall 3 — Collection Types:</strong> <code>HashMap</code> and <code>ArrayList</code> are serializable, but <code>ConcurrentHashMap</code> (in some JDK versions) and Guava's immutable collections may not be. Stick to standard Java collections or arrays.`,
          `<strong>Pitfall 4 — Forgetting to Test with Production Data:</strong> A partitioner that works in dev with simple values may fail in production when it encounters a <code>null</code> that gets auto-boxed to a non-serializable wrapper, or when a new field is added to a value object without <code>Serializable</code>.`,
        ],
      },
    ],
    keyPoints: [
      `Every object in the ExecutionContext must be Serializable for remote partitioning.`,
      `The failure is a NotSerializableException at message-send time — after partitioning, before any worker processes data.`,
      `Never put DataSource, JdbcTemplate, REST clients, or Spring beans in partition context.`,
      `Add a round-trip serialization test to your partitioner unit tests.`,
      `Verify deserialized values match originals — transient fields silently become null.`,
      `Stick to primitives, Strings, standard collections, and explicitly serializable value objects.`,
    ],
    note: {
      label: 'TESTING RULE',
      text: `If your partitioner unit test does not include a serialize-then-deserialize assertion, you do not have a valid remote partitioning test. Add it now.`,
      tone: 'accent',
    },
    quiz: {
      question: `You add a new <code>PartitionConfig</code> object to the ExecutionContext to pass formatting rules to workers. In local testing (same JVM), everything works. In production with remote partitioning, the manager throws <code>NotSerializableException</code> immediately after partitioning. What is wrong?`,
      options: [
        { label: `The PartitionConfig class is not on the worker classpath`, correct: false },
        { label: `The PartitionConfig class does not implement java.io.Serializable`, correct: true },
        { label: `The message broker is not configured for large messages`, correct: false },
        { label: `The ExecutionContext has too many entries`, correct: false },
      ],
      explanation: `Remote partitioning serializes the ExecutionContext to send it over the message broker. Every value in the context must implement Serializable. Local partitioning (same JVM) does not serialize — it passes references directly — so the missing Serializable interface goes unnoticed. The fix is to add "implements Serializable" to PartitionConfig and ensure all its fields are serializable too.`,
    },
  },
  {
    id: '11.11',
    title: 'Broker Choice: JMS/AMQP vs. Kafka',
    duration: '12 min',
    kind: 'concept',
    summary: [
      `The message broker is the backbone of remote partitioning. JMS/AMQP and Kafka are the two common choices, but they have fundamentally different semantics that affect how you build request/reply patterns, handle failures, and scale workers. The choice is not neutral — it shapes your architecture.`,
    ],
    topics: [
      {
        title: 'JMS/AMQP: Natural Point-to-Point',
        body: [
          `JMS (ActiveMQ, Artemis) and AMQP (RabbitMQ) have first-class support for point-to-point queues and request/reply patterns. A manager sends a partition request to a queue; exactly one worker consumes it. When done, the worker sends a reply to a reply queue. The broker handles message acknowledgment, redelivery, and dead-letter routing out of the box.`,
          `This maps cleanly to remote partitioning: one request queue, one reply queue, durable messages, and transactional consumption. If a worker crashes mid-processing, the message is returned to the queue and picked up by another worker (or the same worker after restart). The semantics are well-understood and have decades of production use.`,
        ],
        diagram: `<div class="diagram-caption">JMS/AMQP: Request/Reply Queues</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">Manager JVM</div><div class="dg-pipe"><div class="dg-box dg-box--accent"><div class="dg-box-title">Send Request</div><div class="dg-box-sub">to partition-requests queue</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--green"><div class="dg-box-title">Poll Reply Queue</div><div class="dg-box-sub">blocking receive · ack on read</div></div></div></div><div class="dg-arrow" style="margin:0.5rem 0"><span>↓</span><small>queue</small></div><div class="dg-thread"><div class="dg-thread-label">JMS/AMQP Broker</div><div class="dg-pipe"><div class="dg-box dg-box--dim"><div class="dg-box-title">partition-requests</div><div class="dg-box-sub">point-to-point · exactly-one consumer</div></div><div class="dg-arrow"><span>↔</span></div><div class="dg-box dg-box--dim"><div class="dg-box-title">partition-replies</div><div class="dg-box-sub">point-to-point · manager consumes</div></div></div></div><div class="dg-arrow" style="margin:0.5rem 0"><span>↑</span><small>ack + reply</small></div><div class="dg-workers"><div class="dg-worker"><div class="dg-worker-label">Worker Pool</div><div class="dg-worker-steps"><div class="dg-mini-box">Consume</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Process</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">Ack + Reply</div></div></div></div></div>`,
      },
      {
        title: 'Kafka: Publish/Subscribe with Explicit Reply',
        body: [
          `Kafka has no native request/reply or point-to-point queue concept. It is a distributed log with consumer groups. To build remote partitioning over Kafka, you need: a request topic where the manager publishes partition requests; a consumer group of workers that read from this topic; and a dedicated reply topic where workers publish results.`,
          `The critical difference: Kafka consumer group parallelism is capped by the topic's partition count. If your request topic has 4 partitions, you can have at most 4 concurrent workers in the group — even if you start 20 worker JVMs, only 4 will consume. This is a hard ceiling set at topic creation time.`,
        ],
      },
      {
        title: 'Comparing the Two',
        body: [
          `JMS/AMQP gives dynamic worker scaling: add workers and they immediately start consuming. Kafka gives replayability and log retention: you can re-read partition requests for debugging or audit. JMS/AMQP has built-in transactional semantics (consume-and-ack in one transaction); Kafka requires careful offset management and idempotent processing (11.13).`,
          `For teams already operating Kafka (e.g., for event streaming), adding a request/reply topic pair is reasonable. For teams without Kafka expertise, introducing it solely for batch partitioning is over-engineering — JMS/AMQP is simpler, has better request/reply support, and requires less operational tuning.`,
        ],
        diagram: `<div class="diagram-caption">Broker Comparison: JMS vs Kafka</div><div class="dg-flow"><div class="dg-workers"><div class="dg-worker"><div class="dg-worker-label">JMS/AMQP</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--green">Dynamic scaling</div><span class="dg-mini-arrow">·</span><div class="dg-mini-box dg-box--green">Native req/reply</div><span class="dg-mini-arrow">·</span><div class="dg-mini-box dg-box--green">Txn ack</div></div><div class="dg-box-sub">Best for: teams without Kafka · simpler ops</div></div><div class="dg-worker"><div class="dg-worker-label">Kafka</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--green">Log replay</div><span class="dg-mini-arrow">·</span><div class="dg-mini-box dg-box--red">Partition cap</div><span class="dg-mini-arrow">·</span><div class="dg-mini-box dg-box--red">Manual offset mgmt</div></div><div class="dg-box-sub">Best for: teams already running Kafka · audit needs</div></div></div></div>`,
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Choosing Kafka "Because We Already Have It":</strong> Having Kafka for event streaming does not mean it is the right tool for batch partitioning. The request/reply pattern is awkward, the partition count ceiling is rigid, and offset management adds complexity. Evaluate JMS/AMQP seriously if your team is not already comfortable with Kafka consumer groups.`,
          `<strong>Pitfall 2 — Kafka Topic Partition Count Too Low:</strong> Creating a request topic with 4 partitions and then needing 16 workers means re-creating the topic with more partitions — a disruptive operation that affects all consumers. Size the topic partition count for your maximum expected concurrency at topic creation time.`,
          `<strong>Pitfall 3 — JMS Queue Without Persistence:</strong> An in-memory JMS broker (default ActiveMQ embedded) loses messages on broker restart. For remote partitioning, always configure persistent storage (KahaDB for ActiveMQ, disk persistence for RabbitMQ) so partition requests survive crashes.`,
          `<strong>Pitfall 4 — Mixing Broker Types in One Job:</strong> Do not send partition requests via Kafka and expect replies via JMS. The manager and workers must agree on a single broker and topic/queue topology. Mixing brokers creates a distributed system where no single team owns the integration.`,
        ],
      },
    ],
    keyPoints: [
      `JMS/AMQP has natural point-to-point queues and request/reply — simpler for remote partitioning.`,
      `Kafka requires explicit request and reply topics; consumer group parallelism is capped by topic partition count.`,
      `Kafka topic partition count is set at creation and hard to change later — size for maximum expected concurrency.`,
      `JMS/AMQP supports dynamic worker scaling; Kafka does not without re-partitioning the topic.`,
      `Do not choose Kafka solely because your team already operates it — evaluate fit for the request/reply pattern.`,
      `Always use persistent broker configuration; in-memory brokers lose partition requests on restart.`,
    ],
    note: {
      label: 'RECOMMENDATION',
      text: `If your team does not already operate Kafka, use JMS/AMQP for remote partitioning. The operational simplicity and native request/reply support outweigh Kafka's log replay benefits for batch workloads.`,
      tone: 'accent',
    },
    quiz: {
      question: `Your team already runs Kafka for event streaming and decides to use it for remote batch partitioning. You create a request topic with 6 partitions and deploy 12 worker JVMs. What happens?`,
      options: [
        { label: `All 12 workers consume concurrently, doubling throughput`, correct: false },
        { label: `Only 6 workers consume at a time; the other 6 are idle because Kafka consumer group parallelism is capped by topic partition count`, correct: true },
        { label: `The Kafka broker auto-scales the topic to 12 partitions`, correct: false },
        { label: `The manager crashes because the gridSize exceeds the topic partition count`, correct: false },
      ],
      explanation: `Kafka consumer group parallelism is strictly limited by the number of partitions in the consumed topic. With 6 partitions and 12 consumers in the same group, each partition is assigned to one consumer and the remaining 6 consumers receive no assignments. To use all 12 workers, you would need to create the topic with at least 12 partitions — which requires deleting and recreating the topic, a disruptive operation.`,
    },
  },
  {
    id: '11.12',
    title: 'The Kafka Concurrency Ceiling',
    duration: '10 min',
    kind: 'concept',
    summary: [
      `Kafka's partition-count ceiling is not a soft limit — it is a hard architectural constraint. Understanding why it exists, how to size topics correctly, and what happens when you need to change it later is essential for anyone building remote partitioning on Kafka.`,
    ],
    topics: [
      {
        title: 'Why the Ceiling Exists',
        body: [
          `In Kafka, a partition is the unit of parallelism within a consumer group. Each partition can be consumed by exactly one consumer in the group at a time. This design ensures ordering: messages within a partition are processed in order. If multiple consumers could read the same partition, ordering guarantees would break.`,
          `This means your maximum concurrent worker count is fixed at topic creation time by the partition count. There is no dynamic scaling: adding more worker JVMs does not increase throughput unless you also increase partition count, which is not a runtime operation.`,
        ],
      },
      {
        title: 'Sizing Topics for Batch Partitioning',
        body: [
          `When creating the request topic for remote partitioning, set the partition count to your maximum expected grid size. If you anticipate needing up to 32 concurrent partitions, create the topic with 32 partitions. It is acceptable to have more partitions than active workers — unused partitions simply have no consumer assigned.`,
          `However, each partition has overhead: broker memory for offsets, replication traffic, and consumer group rebalancing time. Do not create 1,000 partitions "just in case." A good starting point for batch partitioning: 2× your current gridSize, capped at 64. You can add partitions later if needed (see below), but you cannot remove them.`,
        ],
        code: `// Creating a Kafka topic with appropriate partition count for batch partitioning
// Using Kafka Admin Client
NewTopic requestTopic = new NewTopic("batch-partition-requests", 32, (short) 3);
// 32 partitions = max 32 concurrent workers
// replication factor 3 for durability

adminClient.createTopics(List.of(requestTopic)).all().get();`,
        codeLabel: 'java',
      },
      {
        title: 'Adding Partitions Later',
        body: [
          `You can add partitions to an existing Kafka topic, but this has side effects. Existing partitions are not rebalanced — the new partitions are empty until new messages arrive. Consumer group rebalancing occurs, which can pause consumption for seconds. If you use keyed messages (e.g., partition by accountId), adding partitions changes the hash ring and may route messages to different partitions than before, breaking ordering assumptions.`,
          `For remote partitioning, messages are typically not keyed (any worker can process any partition), so the hash ring issue is less relevant. But the rebalancing pause still affects job latency. Plan partition count at topic creation time to avoid mid-life changes.`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Default Partition Count (1):</strong> Many teams create topics with default settings, resulting in 1 partition. This means exactly one worker can consume, regardless of how many worker JVMs you deploy. Always explicitly set partition count at topic creation.`,
          `<strong>Pitfall 2 — Confusing Topic Partitions with Batch Partitions:</strong> A Kafka topic with 32 partitions can support 32 concurrent workers, but your <code>Partitioner</code> may produce 64 batch partitions. The extra 32 batch partitions queue in Kafka (one per topic partition, with multiple messages) and are processed sequentially by the assigned worker. This is fine, but understand that your true concurrency is capped at 32.`,
          `<strong>Pitfall 3 — Ignoring Replication Factor:</strong> A partition count of 32 with replication factor 1 means data loss if the broker dies. Use replication factor 3 for partition request topics — the messages contain job state that must survive broker failures.`,
          `<strong>Pitfall 4 — Consumer Group Rebalancing Storms:</strong> If workers frequently join and leave the consumer group (e.g., due to auto-scaling or crashes), Kafka rebalances partition assignments repeatedly. Each rebalance pauses consumption. Use static group membership (<code>group.instance.id</code>) or stable consumer groups to reduce rebalancing.`,
        ],
      },
    ],
    keyPoints: [
      `Kafka consumer group parallelism is strictly capped by the topic's partition count.`,
      `Size the request topic partition count to your maximum expected gridSize at creation time.`,
      `Adding partitions later triggers rebalancing and may change message routing for keyed topics.`,
      `More partitions than workers is fine; fewer partitions than workers wastes JVM resources.`,
      `Use replication factor 3 for partition request topics to survive broker failures.`,
      `Avoid frequent consumer group rebalancing — it pauses partition processing.`,
    ],
    note: {
      label: 'SIZING RULE',
      text: `Create the request topic with partition count = max expected gridSize × 1.5, rounded up. This gives headroom for growth without excessive broker overhead.`,
      tone: 'accent',
    },
    quiz: {
      question: `You have a Kafka request topic with 8 partitions and a consumer group of 4 workers. You need to double throughput by adding 4 more workers. What is the correct approach?`,
      options: [
        { label: `Simply start 4 more worker JVMs — they will automatically share the load`, correct: false },
        { label: `Add 8 more partitions to the topic, then start the 4 new workers`, correct: true },
        { label: `Create a second request topic with 8 partitions and split workers across both`, correct: false },
        { label: `Increase the worker step's chunk size to process more items per partition`, correct: false },
      ],
      explanation: `With 8 partitions and 4 workers, each worker consumes 2 partitions. Adding 4 more workers without adding partitions leaves the new workers idle because all 8 partitions are already assigned. You must add partitions to the existing topic (to 16) so the 8 workers can each consume 2 partitions. Creating a second topic breaks the single consumer group model and requires manager changes. Increasing chunk size improves per-worker throughput but does not increase parallelism.`,
    },
  },
  {
    id: '11.13',
    title: 'Idempotency Under At-Least-Once Delivery',
    duration: '12 min',
    kind: 'concept',
    summary: [
      `Message brokers guarantee at-least-once delivery, not exactly-once. A worker may process a partition request, crash before acknowledging the message, and receive the same request again after restart. Your writer must tolerate reprocessing the same partition without double-writing results.`,
    ],
    topics: [
      {
        title: 'Why At-Least-Once Is Guaranteed',
        body: [
          `In JMS/AMQP, a message is acknowledged after processing. If the worker crashes between processing and ack, the broker redelivers the message. In Kafka, offsets are committed periodically. If the worker crashes between processing and offset commit, the next consumer re-reads from the last committed offset, reprocessing some messages.`,
          `Both scenarios are normal and expected. You cannot prevent them without sacrificing availability (exactly-once requires distributed transactions across the broker and database, which most teams do not implement). The solution is idempotent processing: processing the same input twice produces the same output once.`,
        ],
        diagram: `<div class="diagram-caption">At-Least-Once: Crash Before Ack/Commit</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">Worker Timeline</div><div class="dg-pipe"><div class="dg-box dg-box--green"><div class="dg-box-title">Receive Message</div><div class="dg-box-sub">partition0 request</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--green"><div class="dg-box-title">Process Partition</div><div class="dg-box-sub">write 10K records to DB</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--red"><div class="dg-box-title">CRASH</div><div class="dg-box-sub">before ack / offset commit</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--accent"><div class="dg-box-title">Restart</div><div class="dg-box-sub">same message redelivered</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--red"><div class="dg-box-title">Re-process</div><div class="dg-box-sub">same 10K records · MUST be idempotent</div></div></div></div></div>`,
      },
      {
        title: 'Making the Writer Idempotent',
        body: [
          `The standard approach is to key writes by a natural or deduplication key. For the reconciliation domain, the <code>transactionId</code> is the natural key. Instead of <code>INSERT</code>, use <code>INSERT ... ON CONFLICT (transaction_id) DO NOTHING</code> (Postgres) or equivalent upsert semantics. The first write succeeds; the second write is a no-op.`,
          `If your database does not support upsert, use a pre-write existence check: query for the key before writing. This adds latency but guarantees idempotency. Alternatively, maintain a "processed partition" log table: write the partition name + job execution ID before processing, and skip if already present.`,
        ],
        code: `package com.example.reconciliation.batch;

import com.example.reconciliation.domain.ReconciledTransaction;
import org.springframework.batch.item.Chunk;
import org.springframework.batch.item.ItemWriter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.PreparedStatement;
import java.sql.SQLException;

@Component
public class IdempotentReconciledWriter implements ItemWriter<ReconciledTransaction> {

    private final JdbcTemplate jdbcTemplate;

    public IdempotentReconciledWriter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void write(Chunk<? extends ReconciledTransaction> chunk) throws Exception {
        jdbcTemplate.batchUpdate("""
            INSERT INTO reconciled_transactions
                (transaction_id, account_id, amount, reconciliation_status, note)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (transaction_id) DO NOTHING
            """, chunk, chunk.size(),
            (PreparedStatement ps, ReconciledTransaction tx) -> {
                ps.setString(1, tx.transactionId());
                ps.setString(2, tx.accountId());
                ps.setBigDecimal(3, tx.amount());
                ps.setString(4, tx.reconciliationStatus());
                ps.setString(5, tx.note());
            }
        );
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'Idempotency in the Business Logic',
        body: [
          `Idempotency is not just a writer concern. If your processor sends a side-effect (e.g., a notification email, a ledger debit), that side-effect must also be idempotent. An email is not idempotent — sending it twice annoys the recipient. A ledger debit is not idempotent — doing it twice debits twice.`,
          `For side effects, use an outbox pattern (7.5, 10.3): write the event to an outbox table in the same transaction as the batch write, then have a separate poller publish the event. If the batch transaction rolls back, the outbox row is never inserted. If the batch commits and the worker crashes, the outbox row is present and will be published eventually — exactly once, because the poller tracks its own offset.`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Assuming Exactly-Once Delivery:</strong> No mainstream message broker guarantees exactly-once delivery without distributed transactions. Design for at-least-once from the start.`,
          `<strong>Pitfall 2 — Missing Unique Constraints:</strong> An upsert only works if the database enforces uniqueness on the natural key. Without a unique constraint, <code>ON CONFLICT</code> has nothing to conflict with, and duplicates are inserted.`,
          `<strong>Pitfall 3 — Idempotency Only in Happy Path:</strong> Test idempotency by simulating a worker crash mid-chunk (kill -9) and restarting. Many "idempotent" writers fail when the crash occurs between chunk commits, leaving a partially-written chunk that is not handled by the upsert logic.`,
          `<strong>Pitfall 4 — Forgetting Side Effects:</strong> The batch write may be idempotent, but the email sent by the processor is not. Audit the entire processing chain for non-idempotent side effects.`,
        ],
      },
    ],
    keyPoints: [
      `Message brokers guarantee at-least-once delivery, not exactly-once.`,
      `Design writers for idempotency: upsert by natural key or pre-check existence.`,
      `Idempotency applies to the entire processing chain, including side effects in processors.`,
      `Use database unique constraints to make upserts effective.`,
      `The outbox pattern isolates non-idempotent side effects from the batch transaction.`,
      `Test idempotency by simulating crashes (kill -9) mid-chunk, not just graceful restarts.`,
    ],
    note: {
      label: 'GOLDEN RULE',
      text: `If your writer is not idempotent, remote partitioning is not safe. Full stop. Fix the writer before distributing work.`,
      tone: 'accent',
    },
    quiz: {
      question: `A worker processing a remote partition crashes after writing 5,000 of 10,000 records but before acknowledging the JMS message. The worker restarts and receives the same partition request again. What must be true for the reconciliation to remain correct?`,
      options: [
        { label: `The broker must be configured for exactly-once delivery`, correct: false },
        { label: `The writer must be idempotent — re-writing the same records must not create duplicates`, correct: true },
        { label: `The chunk size must be reduced so less work is lost per crash`, correct: false },
        { label: `The worker must use a distributed transaction manager to coordinate JMS and DB commits`, correct: false },
      ],
      explanation: `At-least-once delivery is a fundamental property of message brokers — it cannot be disabled. Reducing chunk size limits re-work but does not prevent duplicates. Distributed transactions (XA) across JMS and JDBC are possible but complex and rarely used in practice. The correct and practical solution is to make the writer idempotent: use INSERT ... ON CONFLICT or equivalent so that re-processing the same records is a no-op.`,
    },
  },
  {
    id: '11.14',
    title: 'Shared JobRepository Contention at Multi-JVM Scale',
    duration: '10 min',
    kind: 'concept',
    summary: [
      `Remote partitioning with many worker JVMs creates contention on the shared <code>JobRepository</code> database. Each worker updates <code>BATCH_STEP_EXECUTION</code> frequently — on every chunk commit, on status changes, and on context updates. At scale, this becomes a database bottleneck.`,
    ],
    topics: [
      {
        title: 'Where Contention Comes From',
        body: [
          `Every chunk commit in every partition triggers an update to <code>BATCH_STEP_EXECUTION</code>: incrementing <code>read_count</code>, <code>write_count</code>, <code>commit_count</code>; updating <code>version</code> for optimistic locking; and persisting the <code>ExecutionContext</code> to <code>BATCH_STEP_EXECUTION_CONTEXT</code>. With 20 worker JVMs and chunk size 100, that's 200 updates per 10,000 items — per second, if each worker processes 1,000 items/sec.`,
          `The manager JVM adds its own load: polling <code>BATCH_STEP_EXECUTION</code> at <code>pollInterval</code> to detect completion. With 10 managers and 10-second poll intervals, that's 6 queries per minute per manager — modest, but it adds up with many concurrent jobs.`,
        ],
        diagram: `<div class="diagram-caption">JobRepository Contention: Many Workers, One Database</div><div class="dg-flow"><div class="dg-workers"><div class="dg-worker"><div class="dg-worker-label">Worker 1</div><div class="dg-worker-steps"><div class="dg-mini-box">UPDATE</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">UPDATE</div><span class="dg-mini-arrow">→</div></div><div class="dg-box-sub">per chunk commit</div></div><div class="dg-worker"><div class="dg-worker-label">Worker 2</div><div class="dg-worker-steps"><div class="dg-mini-box">UPDATE</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">UPDATE</div><span class="dg-mini-arrow">→</div></div><div class="dg-box-sub">per chunk commit</div></div><div class="dg-worker dg-box--dim"><div class="dg-worker-label">Worker N</div><div class="dg-worker-steps"><div class="dg-mini-box">UPDATE</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">UPDATE</div></div><div class="dg-box-sub">per chunk commit</div></div></div><div class="dg-arrow" style="margin:0.5rem 0"><span>↓</span><small>all write to</small></div><div class="dg-repo"><div class="dg-box dg-box--red"><div class="dg-box-title">JobRepository Database</div><div class="dg-box-sub">BATCH_STEP_EXECUTION · row-level locks · connection pool exhaustion</div></div></div></div>`,
      },
      {
        title: 'Mitigation Strategies',
        body: [
          `1. <strong>Larger chunk sizes:</strong> Fewer commits mean fewer JobRepository updates. Increase chunk size from 100 to 1,000 — this reduces update frequency 10×. Trade-off: larger rollback scope and higher memory per chunk.`,
          `2. <strong>Connection pool sizing:</strong> Each worker needs enough connections for its chunk transactions plus JobRepository updates. Size the shared connection pool to <code>workers × (1 + spare)</code>. A pool of 20 connections for 20 workers is too tight — workers will block on connection acquisition. Use 40–50 connections.`,
          `3. <strong>Longer poll intervals:</strong> Reduce manager polling frequency. If your job runs for 30 minutes, a 30-second poll interval instead of 5 seconds cuts manager query load 6× with negligible latency impact.`,
          `4. <strong>Database indexing:</strong> Ensure <code>BATCH_STEP_EXECUTION</code> has indexes on <code>job_execution_id</code> and <code>status</code>. The manager's poll query filters by these columns; missing indexes cause full table scans.`,
        ],
      },
      {
        title: 'When to Consider a Dedicated JobRepository',
        body: [
          `If your batch workers share the same database as your online application, JobRepository contention can affect user-facing latency. Consider a dedicated database instance or schema for the JobRepository, with its own connection pool. The application database handles business data; the JobRepository database handles metadata.`,
          `This separation also simplifies backup and retention: batch metadata tables grow over time and may need different retention policies than business data. Spring Batch supports table prefixing (<code>spring.batch.jdbc.table-prefix=mybatch.</code>) to co-locate tables in the same database instance but different schemas.`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Undersized Connection Pool:</strong> A connection pool of 10 for 20 workers means 10 workers hold connections for chunk transactions while 10 block. The blocked workers cannot even update JobRepository status, causing cascading delays. Size pools for peak concurrency, not average.`,
          `<strong>Pitfall 2 — Missing Indexes on BATCH Tables:</strong> The framework creates basic indexes, but custom queries (e.g., monitoring dashboards that query step execution history) may need additional indexes. A missing index on a 10M-row <code>BATCH_STEP_EXECUTION</code> table turns a 10ms query into a 30-second scan, locking rows and blocking workers.`,
          `<strong>Pitfall 3 — Storing Large ExecutionContexts:</strong> A partition context with 1,000 entries or large serialized objects bloats <code>BATCH_STEP_EXECUTION_CONTEXT</code>. Each chunk commit re-persists the full context. Keep contexts small — store only restart-critical state, not business data.`,
          `<strong>Pitfall 4 — Shared Database with Online Traffic:</strong> Running 50 batch workers against the same Postgres instance that serves web requests creates I/O contention. Batch writes are sequential and heavy; web traffic is random and latency-sensitive. Separate them before batch jobs affect user experience.`,
        ],
      },
    ],
    keyPoints: [
      `Each worker updates BATCH_STEP_EXECUTION on every chunk commit — scale creates write contention.`,
      `Increase chunk size to reduce update frequency; trade off against rollback scope.`,
      `Size the connection pool for peak worker concurrency, not average load.`,
      `Lengthen poll intervals to reduce manager query load on the JobRepository.`,
      `Index BATCH_STEP_EXECUTION on job_execution_id and status for fast polling queries.`,
      `Consider a dedicated JobRepository database to isolate batch metadata contention from business traffic.`,
    ],
    note: {
      label: 'MONITORING TIP',
      text: `Watch database lock wait time and connection pool saturation during peak batch windows. These are the leading indicators of JobRepository contention before jobs start timing out.`,
      tone: 'accent',
    },
    quiz: {
      question: `You scale from 4 to 40 remote worker JVMs and notice chunk processing slows dramatically. Database monitoring shows high lock wait times on BATCH_STEP_EXECUTION. What is the most effective first mitigation?`,
      options: [
        { label: `Reduce gridSize back to 4 workers`, correct: false },
        { label: `Increase chunk size from 100 to 1,000 to reduce per-worker update frequency`, correct: true },
        { label: `Switch from JDBC to an in-memory JobRepository`, correct: false },
        { label: `Add @EnableBatchProcessing to disable auto-configuration`, correct: false },
      ],
      explanation: `High lock wait times on BATCH_STEP_EXECUTION indicate that workers are contending for row-level locks during frequent updates. Increasing chunk size from 100 to 1,000 reduces the update frequency by 10× per worker, which directly reduces lock contention. Reducing workers defeats the purpose of scaling. In-memory JobRepository was removed in Spring Batch 5.x. @EnableBatchProcessing is irrelevant to database contention.`,
    },
  },
  {
    id: '11.15',
    title: 'Failure & Restart Semantics for Remote Partitions',
    duration: '12 min',
    kind: 'concept',
    summary: [
      `A crashed worker in a remote partitioning setup does not auto-transition its partition to FAILED. The <code>StepExecution</code> remains STARTED in the JobRepository indefinitely. Understanding this behavior — and building detection and timeout strategies around it — is essential for production reliability.`,
    ],
    topics: [
      {
        title: 'The Stuck STARTED Problem',
        body: [
          `When a worker JVM crashes while processing a partition, it cannot update its <code>StepExecution</code> status to FAILED. The last status in the JobRepository is STARTED (or UPDATED if it committed a chunk before crashing). The manager polls the JobRepository and sees STARTED — it assumes the partition is still running and waits.`,
          `There is no built-in timeout in Spring Batch that transitions a long-running STARTED step to FAILED. The framework intentionally does not make assumptions about step duration — a legitimate long-running step could run for hours. This means you must build your own health-check and timeout strategy.`,
        ],
        diagram: `<div class="diagram-caption">Crashed Worker: Stuck STARTED in JobRepository</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">Timeline</div><div class="dg-pipe"><div class="dg-box dg-box--green"><div class="dg-box-title">T+0: Partition Starts</div><div class="dg-box-sub">Status: STARTED</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--green"><div class="dg-box-title">T+5m: Chunk 50 Commits</div><div class="dg-box-sub">Status: STARTED · read=5K</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--red"><div class="dg-box-title">T+7m: WORKER CRASH</div><div class="dg-box-sub">kill -9 · JVM dies</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--accent"><div class="dg-box-title">T+30m: Manager Still Polling</div><div class="dg-box-sub">Status: STARTED · waits forever</div></div></div></div></div>`,
      },
      {
        title: 'Detection Strategies',
        body: [
          `1. <strong>Heartbeat table:</strong> Workers write a timestamp to a heartbeat table every N seconds. A monitor job queries for workers whose heartbeat is stale (e.g., > 2 minutes old) and marks their StepExecution as FAILED in the JobRepository.`,
          `2. <strong>External health checks:</strong> If workers run in Kubernetes, use liveness probes. A crashed pod is restarted, but the new pod gets a new identity and does not resume the old partition. You need a separate reconciliation process that matches running partitions to live pods.`,
          `3. <strong>Step timeout:</strong> Implement a custom monitor that queries <code>BATCH_STEP_EXECUTION</code> for steps with status STARTED and <code>start_time</code> older than a threshold. If exceeded, update status to FAILED with an ExitStatus indicating timeout. This allows restart to pick up the partition.`,
        ],
        code: `package com.example.reconciliation.batch.monitoring;

import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.ExitStatus;
import org.springframework.batch.core.StepExecution;
import org.springframework.batch.core.explore.JobExplorer;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Component
public class StuckPartitionMonitor {

    private final JobExplorer jobExplorer;
    private final JobRepository jobRepository;
    private static final Duration TIMEOUT = Duration.ofMinutes(30);

    public StuckPartitionMonitor(JobExplorer jobExplorer, JobRepository jobRepository) {
        this.jobExplorer = jobExplorer;
        this.jobRepository = jobRepository;
    }

    @Scheduled(fixedRate = 60_000)  // Check every minute
    public void detectAndFailStuckPartitions() {
        List<String> jobNames = jobExplorer.getJobNames();

        for (String jobName : jobNames) {
            // Get running job executions
            var executions = jobExplorer.findRunningJobExecutions(jobName);
            for (var jobExecution : executions) {
                for (StepExecution stepExecution : jobExecution.getStepExecutions()) {
                    if (stepExecution.getStatus() == BatchStatus.STARTED) {
                        LocalDateTime startTime = stepExecution.getStartTime()
                            .toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
                        if (startTime.plus(TIMEOUT).isBefore(LocalDateTime.now())) {
                            stepExecution.setStatus(BatchStatus.FAILED);
                            stepExecution.setExitStatus(new ExitStatus("FAILED",
                                "Partition timed out after " + TIMEOUT.toMinutes() + " minutes"));
                            jobRepository.update(stepExecution);
                        }
                    }
                }
            }
        }
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'Restart After Worker Crash',
        body: [
          `Once a stuck partition is marked FAILED (either by your monitor or manually via <code>JobOperator</code>), the job can be restarted. Spring Batch restarts only the FAILED partitions — successful partitions are skipped. The crashed partition's <code>ExecutionContext</code> contains the last committed chunk position, so restart resumes from there, not from the beginning.`,
          `However, if the worker crashed mid-chunk (after read, before commit), the chunk's items were not written. They will be re-read and re-processed on restart. This is why idempotent writes (11.13) are critical: the re-read chunk may overlap with the last committed chunk, and items from the prior committed chunk must not be duplicated.`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Assuming Auto-Recovery:</strong> Spring Batch does not automatically detect crashed workers. Without a timeout monitor, a crashed partition leaves the job hanging indefinitely. This is a production outage waiting to happen.`,
          `<strong>Pitfall 2 — Timeout Too Aggressive:</strong> A 5-minute timeout may flag legitimate long-running partitions as stuck. Set the timeout based on the 99th percentile partition duration plus a safety margin. For a job where most partitions finish in 10 minutes, use a 45-minute timeout.`,
          `<strong>Pitfall 3 — Manually Updating JobRepository:</strong> Directly SQL-updating <code>BATCH_STEP_EXECUTION</code> to mark a partition FAILED bypasses Spring Batch's state machine and can corrupt restart logic. Always use <code>JobRepository.update()</code> or <code>JobOperator</code> APIs.`,
          `<strong>Pitfall 4 — Forgetting to Alert:</strong> A timeout monitor that silently fixes stuck partitions hides infrastructure problems. Every timeout should generate an alert — it indicates a worker crash, network partition, or resource exhaustion that needs investigation.`,
        ],
      },
    ],
    keyPoints: [
      `A crashed worker leaves its StepExecution as STARTED — Spring Batch does not auto-timeout.`,
      `You must implement your own health-check or timeout monitor to detect stuck partitions.`,
      `Restart re-runs only FAILED partitions, resuming from the last committed chunk in ExecutionContext.`,
      `Set timeouts based on 99th percentile duration, not average — avoid false positives on slow partitions.`,
      `Always use JobRepository APIs to update status; never raw-SQL the batch tables.`,
      `Alert on every timeout — it signals an infrastructure problem, not just a slow job.`,
    ],
    note: {
      label: 'PRODUCTION REQUIREMENT',
      text: `A remote partitioning job without a stuck-partition monitor is not production-ready. The monitor is not optional infrastructure — it is part of the batch architecture.`,
      tone: 'accent',
    },
    quiz: {
      question: `A worker JVM processing remote partition "partition3" is killed with kill -9. The manager continues polling. Thirty minutes later, the partition status is still STARTED. What is the correct recovery action?`,
      options: [
        { label: `Restart the manager JVM — it will detect the missing worker and re-dispatch`, correct: false },
        { label: `Run a SQL UPDATE to set the step execution status to FAILED`, correct: false },
        { label: `Use JobRepository.update() or JobOperator to mark the step as FAILED, then restart the job`, correct: true },
        { label: `Wait indefinitely — the worker may still be alive but slow`, correct: false },
      ],
      explanation: `Spring Batch has no built-in timeout for STARTED steps. Restarting the manager does not change the step status in the JobRepository. Raw SQL updates bypass the framework's state machine and can corrupt restart behavior. The correct approach is to use the framework's API (JobRepository.update() or JobOperator.stop/restart) to transition the step to FAILED, which then allows a clean restart that re-runs only the failed partition. Waiting indefinitely is not a valid production strategy.`,
    },
  },
  {
    id: '11.16',
    title: 'Remote Chunking vs. Remote Partitioning — the Conceptual Split',
    duration: '12 min',
    kind: 'concept',
    summary: [
      `Remote chunking and remote partitioning are the two distributed scaling patterns in Spring Batch, and they are commonly confused. They distribute different things (items vs. partitions), have different failure characteristics, and suit different workloads. Choosing the wrong one is an architectural mistake that is expensive to unwind.`,
    ],
    topics: [
      {
        title: 'What Each Pattern Distributes',
        body: [
          `<strong>Remote partitioning</strong> (11.9) distributes <em>data ranges</em>. The manager splits the dataset into partitions (e.g., accountId ranges) and sends each partition to a worker. Each worker has its own <code>ItemReader</code>, <code>ItemProcessor</code>, and <code>ItemWriter</code> — it is a self-contained mini-batch job. The manager does not see individual items; it only tracks partition completion.`,
          `<strong>Remote chunking</strong> distributes <em>individual items</em>. The manager node runs the <code>ItemReader</code> and reads items sequentially. Each item (or chunk of items) is sent over the wire to a worker, which processes and writes it. The manager coordinates the chunk lifecycle; workers are stateless processors and writers.`,
        ],
        diagram: `<div class="diagram-caption">Remote Partitioning vs Remote Chunking: What Travels Over the Wire</div><div class="dg-flow"><div class="dg-workers"><div class="dg-worker"><div class="dg-worker-label">Remote Partitioning</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--accent">ExecutionContext</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">{minId, maxId}</div></div><div class="dg-box-sub">Manager sends BOUNDS · Worker has its own Reader+Processor+Writer</div></div><div class="dg-worker"><div class="dg-worker-label">Remote Chunking</div><div class="dg-worker-steps"><div class="dg-mini-box dg-box--green">Item(s)</div><span class="dg-mini-arrow">→</span><div class="dg-mini-box">TransactionRecord</div></div><div class="dg-box-sub">Manager sends ITEMS · Worker has Processor+Writer only · Manager owns Reader</div></div></div></div>`,
      },
      {
        title: 'Failure and Ordering Characteristics',
        body: [
          `In remote partitioning, a worker crash affects only its partition. The partition is restarted from its last committed chunk (11.15). Ordering is preserved within each partition because each worker reads its own range sequentially. The manager has no item-level visibility — it cannot retry individual items, only whole partitions.`,
          `In remote chunking, a worker crash loses the in-flight chunk. The manager must detect the failure and re-send the chunk to another worker. Because items travel over the wire, ordering is not guaranteed unless the manager serializes chunks and waits for each to complete before sending the next — which defeats parallelism. Remote chunking is inherently less order-preserving than remote partitioning.`,
        ],
      },
      {
        title: 'When to Use Which',
        body: [
          `Use <strong>remote partitioning</strong> when: the dataset can be split into independent ranges; each range fits in a worker's memory; order within each range matters; and workers can access the source data directly (same database, shared storage). This is the common case for financial reconciliation — split by accountId range, process independently.`,
          `Use <strong>remote chunking</strong> when: the data source is not accessible to workers (e.g., a file on the manager node, a secure API only the manager can call); item processing is expensive and item-level distribution helps; or you need to centralize read logic. Remote chunking is rarer in practice because most batch data lives in shared databases or object storage.`,
        ],
        diagram: `<div class="diagram-caption">Decision Flow: Partitioning vs Chunking</div><div class="dg-flow"><div class="dg-pipe"><div class="dg-box dg-box--dim"><div class="dg-box-title">Can workers access the data source?</div></div><div class="dg-arrow"><span>→</span><small>Yes</small></div><div class="dg-box dg-box--green"><div class="dg-box-title">Remote Partitioning</div><div class="dg-box-sub">Self-contained workers · range-based · order-preserving</div></div></div><div class="dg-pipe" style="margin-top:0.5rem"><div class="dg-box dg-box--dim"><div class="dg-box-title">Can workers access the data source?</div></div><div class="dg-arrow"><span>→</span><small>No</small></div><div class="dg-box dg-box--accent"><div class="dg-box-title">Remote Chunking</div><div class="dg-box-sub">Manager reads · workers process+write · items over wire</div></div></div></div>`,
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Choosing Chunking for "Better Load Balancing":</strong> Remote chunking sends individual items to workers, which seems like finer-grained load balancing. But the network overhead of serializing and deserializing every item (or chunk) across the wire often outweighs the benefit. Partitioning with a dynamic row-count partitioner (11.5) achieves similar load balancing without per-item network cost.`,
          `<strong>Pitfall 2 — Assuming Chunking Is Simpler:</strong> Remote chunking requires transactional messaging (11.18) to ensure chunks are not lost if the manager crashes. This adds significant complexity. Remote partitioning's recovery story is simpler: "re-run the failed partition."`,
          `<strong>Pitfall 3 — Mixing the Two in One Job:</strong> Do not use remote partitioning for one step and remote chunking for another in the same job without clear justification. The operational models differ (worker state, broker topology, failure handling), and mixing them creates a support burden.`,
          `<strong>Pitfall 4 — Forgetting the Reader Location:</strong> In remote chunking, the reader lives on the manager. If the data source is a 100GB file on local disk, the manager becomes a network bottleneck reading and sending items. Remote partitioning avoids this by giving each worker its own reader pointing at shared storage or database shards.`,
        ],
      },
    ],
    keyPoints: [
      `Remote partitioning distributes data ranges (ExecutionContexts); remote chunking distributes individual items.`,
      `Remote partitioning preserves order within each partition; remote chunking does not guarantee order.`,
      `Remote partitioning recovery: re-run the failed partition. Remote chunking recovery: re-send the lost chunk.`,
      `Use remote partitioning when workers can access the data source directly — this is the common case.`,
      `Use remote chunking only when the data source is inaccessible to workers or read logic must be centralized.`,
      `Remote chunking requires transactional messaging; remote partitioning does not.`,
    ],
    note: {
      label: 'DECISION RULE',
      text: `Default to remote partitioning. Reach for remote chunking only when the data source is physically inaccessible to workers or when centralized read control is a hard requirement.`,
      tone: 'accent',
    },
    quiz: {
      question: `Your batch job reads from a CSV file on the manager node's local filesystem. Workers run on separate VMs with no access to this filesystem. The processing is CPU-intensive. Which distributed architecture fits best?`,
      options: [
        { label: `Remote partitioning — give each worker a file range`, correct: false },
        { label: `Remote chunking — manager reads the file and sends items to workers for processing`, correct: true },
        { label: `Local partitioning with a larger thread pool on the manager`, correct: false },
        { label: `Multi-threaded step with SynchronizedItemStreamReader`, correct: false },
      ],
      explanation: `Remote partitioning requires each worker to have its own reader pointing at the data source. If workers cannot access the CSV file, they cannot read their partition. Remote chunking is designed for this scenario: the manager owns the reader (it has file access), reads items, and sends them to workers for processing and writing. Local partitioning and multi-threaded steps are single-JVM solutions that do not scale beyond the manager's CPU and memory.`,
    },
  },
  {
    id: '11.17',
    title: 'Remote Chunking Deep Dive: Manager & Worker Builders',
    duration: '16 min',
    kind: 'concept',
    summary: [
      `Remote chunking in Spring Batch 5.2 uses dedicated builder classes: <code>RemoteChunkingManagerStepBuilder</code> and <code>RemoteChunkingWorkerStepBuilder</code>. The manager step reads items and sends chunks as messages; workers consume chunks, process them, and reply. Understanding the builder contract and message flow is essential for correct configuration.`,
    ],
    topics: [
      {
        title: 'The Manager Side',
        body: [
          `The manager is a step that reads items via an <code>ItemReader</code>, groups them into chunks, and sends each chunk as a message to a request channel. It does not process or write items itself. The <code>RemoteChunkingManagerStepBuilder</code> configures this: you provide the reader, chunk size, and output channel. The builder handles chunk serialization and message sending.`,
          `The manager waits for reply messages indicating chunk completion before reading the next chunk. This is not full streaming — it is request-reply at chunk granularity. If a reply is not received within a timeout, the manager treats the chunk as failed and applies the configured skip/retry policy (9.1).`,
        ],
        code: `package com.example.reconciliation.batch.remotechunk;

import com.example.reconciliation.domain.TransactionRecord;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.integration.chunk.RemoteChunkingManagerStepBuilder;
import org.springframework.batch.item.ItemReader;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.messaging.MessageChannel;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class RemoteChunkingManagerConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public RemoteChunkingManagerConfig(JobRepository jobRepository,
                                        PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public MessageChannel chunkRequests() {
        return new DirectChannel();
    }

    @Bean
    public MessageChannel chunkReplies() {
        return new DirectChannel();
    }

    @Bean
    public Step remoteChunkingManagerStep(ItemReader<TransactionRecord> reader) {
        return new RemoteChunkingManagerStepBuilder("remoteChunkingManager", jobRepository)
                .<TransactionRecord, TransactionRecord>chunk(100, transactionManager)
                .reader(reader)
                .outputChannel(chunkRequests())    // Where chunks are sent
                .inputChannel(chunkReplies())      // Where replies are received
                .build();
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'The Worker Side',
        body: [
          `Workers use <code>RemoteChunkingWorkerStepBuilder</code> to create a step that consumes chunk messages, processes items via an <code>ItemProcessor</code>, and writes results via an <code>ItemWriter</code>. The worker step is not a standard chunk step — it is driven by message arrival, not by a local reader loop.`,
          `Each worker maintains a <code>ChunkProcessorChunkHandler</code> that deserializes the incoming chunk, runs the processor and writer, and sends a reply message back to the manager. The worker does not need a reader bean — the items arrive in the message payload.`,
        ],
        code: `package com.example.reconciliation.batch.remotechunk;

import com.example.reconciliation.domain.ReconciledTransaction;
import com.example.reconciliation.domain.TransactionRecord;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.integration.chunk.RemoteChunkingWorkerStepBuilder;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemWriter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.messaging.MessageChannel;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class RemoteChunkingWorkerConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public RemoteChunkingWorkerConfig(JobRepository jobRepository,
                                       PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public MessageChannel chunkRequests() {
        return new DirectChannel();
    }

    @Bean
    public MessageChannel chunkReplies() {
        return new DirectChannel();
    }

    @Bean
    public Step remoteChunkingWorkerStep(
            ItemProcessor<TransactionRecord, ReconciledTransaction> processor,
            ItemWriter<ReconciledTransaction> writer) {

        return new RemoteChunkingWorkerStepBuilder("remoteChunkingWorker", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(100, transactionManager)
                .processor(processor)
                .writer(writer)
                .inputChannel(chunkRequests())   // Where chunks arrive
                .outputChannel(chunkReplies())   // Where replies go
                .build();
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'Chunk Serialization Over the Wire',
        body: [
          `Chunks are serialized using Spring's messaging converters. By default, this uses Java serialization, which requires all item types to implement <code>Serializable</code>. For the reconciliation domain, <code>TransactionRecord</code> and <code>ReconciledTransaction</code> must be serializable records or classes.`,
          `For cross-language workers or stricter serialization control, configure a custom message converter (e.g., JSON via Jackson). This adds conversion overhead but removes the <code>Serializable</code> requirement and makes debugging easier — you can inspect messages in the broker.`,
        ],
        diagram: `<div class="diagram-caption">Remote Chunking: Message Flow</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">Manager JVM</div><div class="dg-pipe"><div class="dg-box dg-box--accent"><div class="dg-box-title">ItemReader</div><div class="dg-box-sub">reads chunk[100]</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--green"><div class="dg-box-title">Serialize + Send</div><div class="dg-box-sub">Chunk&lt;TransactionRecord&gt; → request channel</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--dim"><div class="dg-box-title">Wait for Reply</div><div class="dg-box-sub">blocks until worker acks</div></div></div></div><div class="dg-arrow" style="margin:0.5rem 0"><span>↓</span><small>request</small></div><div class="dg-thread"><div class="dg-thread-label">Message Broker</div><div class="dg-pipe"><div class="dg-box dg-box--dim"><div class="dg-box-title">Request Queue</div></div><div class="dg-arrow"><span>↔</span></div><div class="dg-box dg-box--dim"><div class="dg-box-title">Reply Queue</div></div></div></div><div class="dg-arrow" style="margin:0.5rem 0"><span>↑</span><small>reply</small></div><div class="dg-thread"><div class="dg-thread-label">Worker JVM</div><div class="dg-pipe"><div class="dg-box dg-box--green"><div class="dg-box-title">Deserialize</div><div class="dg-box-sub">Chunk&lt;TransactionRecord&gt;</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--accent"><div class="dg-box-title">Process + Write</div><div class="dg-box-sub">processor → writer → commit</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--green"><div class="dg-box-title">Send Reply</div><div class="dg-box-sub">success / failure → reply channel</div></div></div></div></div>`,
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Items Not Serializable:</strong> If <code>TransactionRecord</code> is a record class without <code>Serializable</code>, Java serialization fails at send time. Either implement <code>Serializable</code> or switch to a JSON message converter.`,
          `<strong>Pitfall 2 — Chunk Size Mismatch:</strong> The manager's chunk size (100) and the worker's chunk size (100) must match. If they differ, the worker may receive a chunk larger than its configured size, causing unexpected memory pressure or transaction timeout.`,
          `<strong>Pitfall 3 — Forgetting Transaction Manager on Worker:</strong> The worker step still needs a <code>PlatformTransactionManager</code> to commit chunk writes. Without it, the worker processes items but never commits, and the database sees nothing.`,
          `<strong>Pitfall 4 — Manager Blocking on Slow Workers:</strong> The manager waits for each chunk's reply before reading the next. If one worker is slow, the entire pipeline stalls. This is inherent to the design — remote chunking does not pipeline chunks. For higher throughput, use remote partitioning instead.`,
        ],
      },
    ],
    keyPoints: [
      `RemoteChunkingManagerStepBuilder configures the manager: reader + output channel + reply channel.`,
      `RemoteChunkingWorkerStepBuilder configures workers: processor + writer + request channel + reply channel.`,
      `Items/chunks must be serializable for transport; consider JSON converters for flexibility.`,
      `Manager and worker chunk sizes must match to avoid memory and transaction mismatches.`,
      `The manager blocks on each chunk reply — slow workers stall the entire pipeline.`,
      `Workers do not need a reader; items arrive in the message payload.`,
    ],
    note: {
      label: 'VERSION NOTE',
      text: `Spring Batch 6.0 may unify remote chunking APIs. In 5.2, use the dedicated builder classes shown above. Check the 6.0 migration guide (17.5) before upgrading.`,
      tone: 'accent',
    },
    quiz: {
      question: `In a remote chunking setup, the manager reads items and sends chunks to workers. A worker processes a chunk successfully but crashes before sending the reply. What happens?`,
      options: [
        { label: `The manager detects the crash and automatically re-sends the chunk to another worker`, correct: false },
        { label: `The manager blocks indefinitely waiting for the reply, stalling the job`, correct: true },
        { label: `The worker restarts and resumes from its last committed chunk automatically`, correct: false },
        { label: `The chunk is lost because remote chunking does not persist chunk state`, correct: false },
      ],
      explanation: `The manager blocks on each chunk reply before reading the next chunk. If a worker crashes after processing but before replying, the manager has no mechanism to detect the crash — it simply waits for a reply that never arrives. This is why remote chunking requires transactional messaging (11.18) and timeout handling. Without these, the job stalls. The processed chunk was committed by the worker, but the manager does not know that.`,
    },
  },
  {
    id: '11.18',
    title: 'Remote Chunking: Ordering & Transactional Messaging',
    duration: '14 min',
    kind: 'concept',
    summary: [
      `Since workers process chunks outside the manager's local transaction, remote chunking needs transactional or acknowledged messaging to prevent data loss. If the manager crashes after sending a chunk but before receiving the reply, the chunk must either be re-processable or the reply must survive the crash. This lecture covers the messaging guarantees required for safe remote chunking.`,
    ],
    topics: [
      {
        title: 'The Transactional Messaging Requirement',
        body: [
          `In remote partitioning (11.9), each partition is self-contained. A worker crash means the partition is re-run from its last committed chunk. In remote chunking, the manager owns the reader state, and workers are stateless. If the manager crashes, it loses track of which chunks were in flight.`,
          `The solution is transactional messaging: the chunk message is sent and the reply is consumed within transactions that can be rolled back. If the manager crashes, unacknowledged request messages are returned to the queue and re-consumed by another manager instance or after restart. Similarly, worker replies must be durable — if the worker commits its database write but the reply is lost, the manager will re-send the chunk, requiring idempotent workers (11.13).`,
        ],
        diagram: `<div class="diagram-caption">Transactional Messaging: Request and Reply Bound to Transactions</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">Manager Transaction</div><div class="dg-pipe"><div class="dg-box dg-box--green"><div class="dg-box-title">Read Chunk</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--accent"><div class="dg-box-title">Send Request (TX)</div><div class="dg-box-sub">message sent in JMS/Kafka tx</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--green"><div class="dg-box-title">Receive Reply (TX)</div><div class="dg-box-sub">ack on successful read</div></div></div></div><div class="dg-arrow" style="margin:0.5rem 0"><span>↕</span><small>broker persists</small></div><div class="dg-thread"><div class="dg-thread-label">Worker Transaction</div><div class="dg-pipe"><div class="dg-box dg-box--accent"><div class="dg-box-title">Receive Request (TX)</div><div class="dg-box-sub">ack after processing</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--green"><div class="dg-box-title">Process + Write DB</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--accent"><div class="dg-box-title">Send Reply (TX)</div></div></div></div></div>`,
      },
      {
        title: 'JMS/AMQP Transactional Semantics',
        body: [
          `JMS and AMQP support local transactions on the session/channel. A worker can consume a chunk message, process it, write to the database, and send a reply — all within a single JMS transaction. If any step fails, the JMS transaction rolls back: the message is returned to the queue, the database write is undone (if using XA or the DB tx is bound to the JMS tx), and no reply is sent.`,
          `For non-XA setups (most common), the worker commits the database transaction independently of the JMS transaction. This creates a two-system commit problem (7.5): if the DB commits but the JMS ack fails, the message is redelivered and the chunk is re-processed. This is acceptable if the worker is idempotent (11.13), which it must be anyway.`,
        ],
      },
      {
        title: 'Kafka Transactional Semantics',
        body: [
          `Kafka supports transactions via the <code> KafkaTransactions</code> API (producer transactions). A worker can begin a Kafka transaction, send the reply, and commit the transaction atomically with the database write only if using a transactional outbox or change data capture — Kafka does not natively coordinate with external databases.`,
          `More practically, use Kafka's idempotent producer and at-least-once delivery with idempotent workers. Enable <code>enable.idempotence=true</code> on the producer to prevent duplicate replies. Use manual offset commits after successful processing, and store offsets in the database alongside business data (consumer-side offset storage) for atomicity.`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Non-Transactional Broker Configuration:</strong> Using an in-memory broker or non-persistent queues for remote chunking means messages are lost on broker restart. Always configure persistent storage and durable queues/topics.`,
          `<strong>Pitfall 2 — Auto-Ack Without Processing:</strong> If the worker auto-acks messages on receive (before processing), a crash after ack but before processing loses the chunk silently. Use manual acknowledgment and ack only after successful write.`,
          `<strong>Pitfall 3 — Manager Crash with In-Flight Chunks:</strong> Even with transactional messaging, a manager crash leaves chunks in flight. On restart, the manager must reconcile: which chunks were sent but not replied? A simple approach is to restart the step from the last known committed position, accepting that some chunks may be re-processed (requires idempotent workers).`,
          `<strong>Pitfall 4 — Ignoring Message Size Limits:</strong> A chunk of 100 <code>TransactionRecord</code> objects may serialize to several megabytes. JMS and Kafka have message size limits (default 1MB for Kafka). Exceeding these causes send failures. Monitor chunk serialization size and reduce chunk size if needed.`,
        ],
      },
    ],
    keyPoints: [
      `Remote chunking requires transactional or acknowledged messaging to prevent chunk loss on manager crash.`,
      `JMS/AMQP supports local transactions that can bind message consumption to processing.`,
      `Kafka requires idempotent producers and manual offset management for safe chunk processing.`,
      `Workers must be idempotent — chunks may be re-sent after manager restart or message redelivery.`,
      `Never auto-ack messages before processing; ack only after successful database commit.`,
      `Monitor serialized chunk size against broker message limits.`,
    ],
    note: {
      label: 'ARCHITECTURE WARNING',
      text: `Remote chunking's transactional messaging requirements make it significantly more complex than remote partitioning. If you do not have a team experienced with transactional messaging, do not use remote chunking.`,
      tone: 'accent',
    },
    quiz: {
      question: `You configure remote chunking with a JMS broker. Workers auto-acknowledge messages immediately on receipt, then process and write to the database. During load testing, you kill a worker mid-processing. Some chunks are never processed. Why?`,
      options: [
        { label: `The JMS broker lost the messages due to non-persistent storage`, correct: false },
        { label: `The worker auto-acked the message before processing, so the broker removed it from the queue and never redelivered`, correct: true },
        { label: `The manager did not re-send the chunks because it crashed too`, correct: false },
        { label: `The database transaction rolled back but the JMS message was already gone`, correct: false },
      ],
      explanation: `Auto-acknowledgment tells the broker the message was consumed successfully as soon as it is received, before any processing occurs. If the worker crashes after ack but before processing, the broker has already removed the message and will not redeliver it. The correct pattern is manual acknowledgment: ack the message only after the database write commits successfully. This ensures that a crash before ack returns the message to the queue for redelivery.`,
    },
  },
  {
    id: '11.19',
    title: 'Local Chunking / SEDA-Style Processing (5.2/6.0)',
    duration: '12 min',
    kind: 'concept',
    summary: [
      `Between plain multi-threading (11.2) and full remote chunking (11.17) lies an intermediate architecture: in-JVM staged event-driven processing using <code>BlockingQueueItemReader</code> and <code>BlockingQueueItemWriter</code>. This SEDA-style approach decouples read, process, and write into staged pipelines within a single JVM, avoiding network overhead while gaining pipeline parallelism.`,
    ],
    topics: [
      {
        title: 'The SEDA Model in Spring Batch',
        body: [
          `SEDA (Staged Event-Driven Architecture) breaks processing into stages connected by queues. In Spring Batch 5.2, you can approximate this by chaining steps where the first step writes to a <code>BlockingQueue</code> and the second step reads from it. More directly, <code>BlockingQueueItemReader</code> and <code>BlockingQueueItemWriter</code> (available in Spring Batch 5.2+) allow a producer thread to write items to a queue while consumer threads read and process them — all within the same JVM.`,
          `This is useful when: the reader is slow (e.g., paginated API calls) and the processor is fast; or the processor is CPU-bound and the writer is I/O-bound. By decoupling the stages with a queue, the fast stage does not wait for the slow stage on every chunk.`,
        ],
        diagram: `<div class="diagram-caption">SEDA-Style: Staged Pipeline with BlockingQueue</div><div class="dg-flow"><div class="dg-thread"><div class="dg-thread-label">Stage 1: Reader Thread</div><div class="dg-pipe"><div class="dg-box dg-box--accent"><div class="dg-box-title">ItemReader</div><div class="dg-box-sub">slow API calls</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--green"><div class="dg-box-title">BlockingQueueItemWriter</div><div class="dg-box-sub">writes to queue</div></div></div></div><div class="dg-arrow" style="margin:0.5rem 0"><span>↓</span><small>queue buffers</small></div><div class="dg-thread"><div class="dg-thread-label">Stage 2: Consumer Threads</div><div class="dg-pipe"><div class="dg-box dg-box--green"><div class="dg-box-title">BlockingQueueItemReader</div><div class="dg-box-sub">reads from queue</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--accent"><div class="dg-box-title">ItemProcessor</div><div class="dg-box-sub">CPU-bound</div></div><div class="dg-arrow"><span>→</span></div><div class="dg-box dg-box--accent"><div class="dg-box-title">ItemWriter</div><div class="dg-box-sub">fast DB writes</div></div></div></div></div>`,
      },
      {
        title: 'BlockingQueueItemReader and BlockingQueueItemWriter',
        body: [
          `These classes bridge two steps via an in-memory <code>BlockingQueue</code>. The first step uses <code>BlockingQueueItemWriter</code> as its writer, which places items on the queue instead of writing to a database. The second step uses <code>BlockingQueueItemReader</code> as its reader, which polls the queue for items.`,
          `The queue capacity controls backpressure: if the queue is full, the writer blocks until space is available. If the queue is empty, the reader blocks until items arrive. This natural backpressure prevents memory exhaustion when the producer outpaces the consumer.`,
        ],
        code: `package com.example.reconciliation.batch.seda;

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
import org.springframework.batch.item.support.BlockingQueueItemReader;
import org.springframework.batch.item.support.BlockingQueueItemWriter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

@Configuration
public class SedaStyleJobConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public SedaStyleJobConfig(JobRepository jobRepository,
                               PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public BlockingQueue<TransactionRecord> transactionQueue() {
        // Capacity controls backpressure — tune based on memory budget
        return new ArrayBlockingQueue<>(10_000);
    }

    @Bean
    public Job sedaReconciliationJob(Step readStep, Step processStep) {
        return new JobBuilder("sedaReconciliationJob", jobRepository)
                .start(readStep)
                .next(processStep)
                .build();
    }

    // Stage 1: Read from source and enqueue
    @Bean
    public Step readStep(ItemReader<TransactionRecord> sourceReader) {
        return new StepBuilder("readStep", jobRepository)
                .<TransactionRecord, TransactionRecord>chunk(100, transactionManager)
                .reader(sourceReader)
                .writer(queueWriter())
                .build();
    }

    @Bean
    public ItemWriter<TransactionRecord> queueWriter() {
        return new BlockingQueueItemWriter<>(transactionQueue());
    }

    // Stage 2: Dequeue, process, and write to DB
    @Bean
    public Step processStep(ItemProcessor<TransactionRecord, ReconciledTransaction> processor,
                            ItemWriter<ReconciledTransaction> dbWriter) {
        return new StepBuilder("processStep", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(100, transactionManager)
                .reader(queueReader())
                .processor(processor)
                .writer(dbWriter)
                .build();
    }

    @Bean
    public ItemReader<TransactionRecord> queueReader() {
        return new BlockingQueueItemReader<>(transactionQueue());
    }
}`,
        codeLabel: 'java',
      },
      {
        title: 'When SEDA Fits',
        body: [
          `SEDA-style processing fits when you need pipeline parallelism within one JVM but do not want the complexity of remote chunking. It is particularly effective for: (1) read-heavy steps where the reader is the bottleneck — the queue allows the reader to prefetch ahead of processing; (2) steps with heterogeneous stage speeds — one stage is I/O-bound, another CPU-bound; and (3) scenarios where you want to limit memory usage via bounded queues instead of unbounded in-memory collections.`,
          `It does not fit when: the queue would not fit in memory (e.g., billions of items); you need crash recovery of queue state (in-memory queues are lost on JVM crash); or you need cross-JVM scaling (use remote partitioning instead).`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Unbounded Queue:</strong> Using <code>LinkedBlockingQueue</code> with default capacity (Integer.MAX_VALUE) allows the reader to enqueue the entire dataset into memory. For a 10M-record job, this exhausts heap. Always use <code>ArrayBlockingQueue</code> with a bounded capacity.`,
          `<strong>Pitfall 2 — Queue Lost on Crash:</strong> The queue is in-memory. If the JVM crashes after the read step completes but before the process step finishes, queued items are lost. The job restart re-runs from the read step, which re-enqueues everything. This is safe but wasteful. For critical data, use a persistent queue (e.g., embedded H2 or JMS) or skip SEDA entirely.`,
          `<strong>Pitfall 3 — Deadlock on Empty Queue:</strong> <code>BlockingQueueItemReader</code> blocks indefinitely if the queue is empty. If the read step fails and never enqueues items, the process step hangs forever. Set a timeout on the reader or use a poison-pill pattern to signal completion.`,
          `<strong>Pitfall 4 — Ignoring Queue Capacity in Memory Planning:</strong> A queue of 10,000 <code>TransactionRecord</code> objects may consume significant heap. Calculate <code>queueCapacity × averageObjectSize</code> and ensure it fits within your JVM's heap budget alongside other memory usage.`,
        ],
      },
    ],
    keyPoints: [
      `SEDA-style processing uses BlockingQueue to decouple read, process, and write stages within one JVM.`,
      `BlockingQueueItemWriter and BlockingQueueItemReader bridge two steps via an in-memory queue.`,
      `Queue capacity provides natural backpressure — use bounded queues (ArrayBlockingQueue) always.`,
      `SEDA fits when stages have mismatched speeds and you want pipeline parallelism without network overhead.`,
      `In-memory queues are lost on JVM crash — restart re-runs the read step, re-enqueuing all data.`,
      `Do not use SEDA if the dataset exceeds available memory or if queue durability is required.`,
    ],
    note: {
      label: 'MIDDLE GROUND',
      text: `SEDA is the middle ground between multi-threaded steps (shared everything) and remote chunking (network overhead). Use it when one stage is clearly the bottleneck and you want to pipeline within one JVM.`,
      tone: 'accent',
    },
    quiz: {
      question: `You have a batch step where reading from a paginated REST API takes 500ms per page but processing and writing are fast. You want the reader to prefetch pages while previous pages are being processed, all within one JVM. Which architecture fits best?`,
      options: [
        { label: `Remote partitioning — split the API pages across workers`, correct: false },
        { label: `Remote chunking — send each page over the wire to workers`, correct: false },
        { label: `SEDA-style with BlockingQueueItemReader/Writer — decouple read and process stages in one JVM`, correct: true },
        { label: `Multi-threaded step with SynchronizedItemStreamReader`, correct: false },
      ],
      explanation: `Remote partitioning requires workers to access the data source, but the REST API may have rate limits or auth constraints that make distributing access difficult. Remote chunking adds network overhead for sending pages across the wire. A multi-threaded step with SynchronizedItemStreamReader would serialize the slow reads, defeating the purpose. SEDA-style processing with a BlockingQueue allows the reader to prefetch pages into the queue while consumer threads process earlier pages — the ideal fit for mismatched stage speeds within one JVM.`,
    },
  },
  {
    id: '11.20',
    title: 'Choosing Between All Five Scaling Approaches',
    duration: '14 min',
    kind: 'concept',
    summary: [
      `This section brings together everything from 11.1 through 11.19 into a decision framework. You now know five architectures: single-threaded, multi-threaded, local partitioning, remote partitioning, and remote chunking (plus SEDA as a variant). The wrong choice costs months of operational pain. The right choice is justified by measured constraints, not by hype or default preference.`,
    ],
    topics: [
      {
        title: 'The Decision Framework',
        body: [
          `Start with the simplest architecture that meets your SLA and measure before escalating. The framework has four decision gates:`,
          `1. <strong>Volume:</strong> Under ~100K records? Single-threaded (11.1) is likely sufficient.`,
          `2. <strong>Order sensitivity:</strong> Must records be processed in strict sequence? Skip multi-threaded (11.2) and partitioning unless each partition's range preserves order.`,
          `3. <strong>Data source access:</strong> Can workers reach the data? Yes → partitioning. No → chunking or SEDA.`,
          `4. <strong>Infrastructure:</strong> Does your team already operate a message broker? No → stay local (multi-threaded or local partitioning). Yes → evaluate remote partitioning.`,
        ],
        diagram: `<div class="diagram-caption">Architecture Decision Tree</div><div class="dg-flow"><div class="dg-pipe"><div class="dg-box dg-box--dim"><div class="dg-box-title">&lt; 100K records?</div></div><div class="dg-arrow"><span>→</span><small>Yes</small></div><div class="dg-box dg-box--green"><div class="dg-box-title">Single-Threaded (11.1)</div><div class="dg-box-sub">Default choice · simplest · order-preserving</div></div></div><div class="dg-pipe" style="margin-top:0.3rem"><div class="dg-box dg-box--dim"><div class="dg-box-title">&gt; 100K · Order-sensitive?</div></div><div class="dg-arrow"><span>→</span><small>Yes</small></div><div class="dg-box dg-box--accent"><div class="dg-box-title">Local Partitioning (11.4)</div><div class="dg-box-sub">Range-based · per-partition order · same JVM</div></div></div><div class="dg-pipe" style="margin-top:0.3rem"><div class="dg-box dg-box--dim"><div class="dg-box-title">&gt; 100K · Order not required?</div></div><div class="dg-arrow"><span>→</span><small>Yes</small></div><div class="dg-box dg-box--accent"><div class="dg-box-title">Multi-Threaded (11.2) or Local Partitioning</div></div></div><div class="dg-pipe" style="margin-top:0.3rem"><div class="dg-box dg-box--dim"><div class="dg-box-title">Need &gt; 1 JVM?</div></div><div class="dg-arrow"><span>→</span><small>Yes · Broker exists</small></div><div class="dg-box dg-box--accent"><div class="dg-box-title">Remote Partitioning (11.9)</div></div></div><div class="dg-pipe" style="margin-top:0.3rem"><div class="dg-box dg-box--dim"><div class="dg-box-title">Workers cannot access data?</div></div><div class="dg-arrow"><span>→</span><small>Yes</small></div><div class="dg-box dg-box--red"><div class="dg-box-title">Remote Chunking (11.17)</div><div class="dg-box-sub">Last resort · complex · items over wire</div></div></div></div>`,
      },
      {
        title: 'Measuring Before Deciding',
        body: [
          `The framework is worthless without data. Before choosing an architecture, run the job single-threaded in a production-like environment and capture:`,
          `- <strong>Chunk-commit rate:</strong> chunks per minute. If flat and SLA is met, stop.`,
          `- <strong>CPU utilization:</strong> If < 50%, the bottleneck is I/O, not compute.`,
          `- <strong>Database connection utilization:</strong> If near 100%, adding threads won't help without more connections.`,
          `- <strong>Reader vs processor vs writer time:</strong> Use <code>ItemReadListener</code>/<code>ItemProcessListener</code>/<code>ItemWriteListener</code> (8.3) to time each phase. If 90% of time is in the reader, virtual threads (11.7) or SEDA (11.19) may help more than partitioning.`,
        ],
      },
      {
        title: 'Common Anti-Patterns',
        body: [
          `<strong>Anti-Pattern 1 — "We Have Kafka, So We Use Remote Partitioning":</strong> Infrastructure availability is not a justification. If single-threaded meets your SLA, adding Kafka adds failure modes with no benefit. The presence of a broker is a necessary condition for remote partitioning, not a sufficient one.`,
          `<strong>Anti-Pattern 2 — Premature Partitioning:</strong> A team that partitions a 20K-record job into 16 partitions because "it's best practice" has introduced 16× the operational surface for negligible gain. Partitioning overhead (step startup, connection acquisition, context resolution) dominates for small jobs.`,
          `<strong>Anti-Pattern 3 — Ignoring Team Expertise:</strong> Remote partitioning requires understanding of distributed systems, message brokers, and the Spring Integration stack. If your team has no operational experience with the chosen broker, the first production incident will be a pager storm. Match architecture to team capability.`,
          `<strong>Anti-Pattern 4 — Architecture by Benchmark Hype:</strong> A blog post showing "10× speedup with remote partitioning" used 100M records and 64 workers. Your job processes 200K records. The benchmark is irrelevant. Measure your own job.`,
        ],
      },
      {
        title: 'Documenting the Decision',
        body: [
          `Once you choose an architecture, document the decision with: the measured single-threaded runtime; the SLA requirement; the bottleneck identified (CPU, I/O, memory); the chosen architecture and why it addresses that bottleneck; and the operational runbook for the architecture (broker monitoring, stuck partition detection, restart procedures).`,
          `This documentation is not bureaucracy — it is the reference you will use when the job slows down six months later and someone asks "why didn't we just use Kafka?" The answer should be in the document, not in someone's memory.`,
        ],
      },
      {
        title: 'Common Pitfalls',
        body: [
          `<strong>Pitfall 1 — Revisiting the Decision Without New Data:</strong> Once an architecture is chosen and operational, changing it requires new evidence — a falling chunk-commit rate, a missed SLA, or a volume projection that exceeds the architecture's known limit. Do not refactor because a new team member prefers a different pattern.`,
          `<strong>Pitfall 2 — Mixing Architectures in One Job:</strong> A job with one single-threaded step, one multi-threaded step, and one partitioned step is valid but complex. Each step has different failure modes, monitoring needs, and restart behavior. Prefer consistency within a job unless a specific step has unique constraints.`,
          `<strong>Pitfall 3 — Forgetting the Baseline:</strong> After scaling to remote partitioning, re-measure the single-threaded baseline periodically. Data volumes change, hardware improves, and the baseline may now meet the SLA without distributed complexity. Architecture decisions are not permanent.`,
          `<strong>Pitfall 4 — No Rollback Plan:</strong> If remote partitioning fails in production (broker outage, serialization bugs, stuck partitions), can you fall back to local partitioning or single-threaded with a configuration change? Maintain a fallback path — do not make distributed architecture the only option.`,
        ],
      },
    ],
    keyPoints: [
      `Start with single-threaded and measure before escalating to any distributed architecture.`,
      `The decision framework gates on: volume, order sensitivity, data source access, and infrastructure.`,
      `Do not choose an architecture because of existing infrastructure ("we have Kafka") or benchmark hype.`,
      `Match architecture to team capability — distributed systems require operational expertise.`,
      `Document the decision with measurements, SLA, bottleneck, and runbook.`,
      `Maintain a fallback path — distributed architecture should not be the only option.`,
    ],
    note: {
      label: 'FINAL WORD',
      text: `The best architecture is the simplest one that meets your SLA with margin. Complexity is a liability that accrues interest over time. Pay it only when measurement proves you must.`,
      tone: 'accent',
    },
    quiz: {
      question: `A team proposes using remote partitioning with Kafka for a nightly job that processes 150K records in 20 minutes single-threaded, well within its 2-hour SLA. The team already operates Kafka for event streaming. What is your assessment?`,
      options: [
        { label: `Approve — the team has Kafka expertise and remote partitioning is always better than single-threaded`, correct: false },
        { label: `Reject without data — single-threaded already meets SLA; adding Kafka introduces failure modes with no measured benefit`, correct: true },
        { label: `Approve but only if they use 32 partitions to maximize parallelism`, correct: false },
        { label: `Reject and mandate local partitioning instead — it is simpler than remote`, correct: false },
      ],
      explanation: `The single-threaded job meets its SLA with a 6× margin (20 minutes vs 2 hours). Adding remote partitioning introduces operational complexity, broker dependency, serialization requirements, and stuck-partition monitoring — all for no measurable gain. The correct decision is to stay single-threaded until data shows the SLA is at risk. "We have Kafka" is not a justification; "single-threaded cannot meet SLA" is. Local partitioning is also unnecessary at this volume and performance level.`,
    },
  },
];