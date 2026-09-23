export default [
  {
    id: '4.1',
    title: 'Read-Process-Write Loop and the Chunk Boundary',
    duration: '10 min',
    kind: 'concept',
    summary: [
      'Chunk-oriented processing is the engine that powers almost every Spring Batch job. At its core, the framework runs a tight loop: <strong>read</strong> one item from the source, <strong>process</strong> it through your business logic, and accumulate it in a list. When that list reaches the <em>chunk size</em>, the entire batch is handed to the <strong>writer</strong> in one operation, and the transaction commits. The chunk is both the unit of work and the unit of transaction commit. If any item in the chunk fails — whether during reading, processing, or writing — the entire chunk rolls back and can be retried or skipped according to your policy (see 9.1).',
      'Why is this design so important? Imagine reading one database row at a time and issuing one <code>INSERT</code> per row inside its own transaction. That creates enormous overhead: connection acquisition, transaction begin, commit, and release for every single record. Now imagine the opposite extreme: reading millions of rows into a giant <code>List</code> and writing them all in one transaction. If one row fails validation, the entire million-row transaction rolls back, wasting hours of work and potentially running out of memory. The chunk is the deliberate sweet spot between these two disasters. It batches writes to amortize transaction cost, but keeps the rollback window small enough that recovery is fast and memory usage is bounded. In our reconciliation example, a chunk size of 100 means the database sees one batch insert of 100 <code>ReconciledTransaction</code> rows per transaction — not 100 individual inserts, and not one terrifying multi-million-row insert.',
      'The three interfaces have distinct responsibilities. <code>ItemReader&lt;T&gt;</code> has a single method <code>read()</code> that returns one item per call, or <code>null</code> when the input is exhausted. <code>ItemProcessor&lt;I, O&gt;</code> transforms or validates that single item, returning the transformed object or <code>null</code> to filter it out silently. <code>ItemWriter&lt;T&gt;</code> is different: it receives a <code>Chunk&lt;T&gt;</code> — a collection containing all items in the current chunk — and writes them as a batch. This asymmetry is intentional. The reader and processor operate on individual items because business rules must be evaluated per record. The writer operates on the group because this is where you exploit batch APIs like JDBC <code>addBatch()</code> / <code>executeBatch()</code>, or JPA <code>flush()</code> on a collection of entities. Trying to write one item at a time inside a loop inside the writer defeats the entire purpose of chunk processing.',
      'The chunk boundary is also the restart boundary. After a chunk commits successfully, Spring Batch stores the current reader position in the <code>ExecutionContext</code> (see 2.3). If the job crashes during chunk 47, the next restart begins at the start of chunk 47 — not at the beginning of the file. This means chunks should be sized so that reprocessing one chunk is cheap, but not so small that transaction overhead dominates. For reconciliation workloads with moderate per-row processing, a chunk size between 100 and 500 is a common starting point. You will tune this later (4.2), but the key insight is that the chunk is not just a performance knob — it is the fundamental unit of reliability.',
    ],
    keyPoints: [
      'The chunk is the unit of read-process accumulation and the unit of transaction commit.',
      '<code>ItemReader</code> and <code>ItemProcessor</code> work on <strong>single items</strong>; <code>ItemWriter</code> works on a <strong>batch of items</strong>.',
      'Chunk sizing balances transaction overhead (larger is better) against memory and rollback cost (smaller is better).',
      'The chunk boundary is the restart boundary — the <code>ExecutionContext</code> is updated after each successful chunk commit.',
      'A typical starting chunk size for reconciliation-scale jobs is <strong>100–500 rows</strong>.',
      'Writing one item at a time inside the <code>ItemWriter</code> defeats the purpose of chunk processing.',
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
public class ChunkLoopDemoConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public ChunkLoopDemoConfig(JobRepository jobRepository,
                               PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job chunkDemoJob() {
        return new JobBuilder("chunkDemoJob", jobRepository)
                .start(chunkDemoStep())
                .build();
    }

    @Bean
    public Step chunkDemoStep() {
        // chunk(100) = read 100 items, process 100 items, then write all 100 in one batch
        return new StepBuilder("chunkDemoStep", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(100, transactionManager)
                .reader(csvReader())
                .processor(enrichmentProcessor())
                .writer(batchJdbcWriter())
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
    public ItemProcessor<TransactionRecord, ReconciledTransaction> enrichmentProcessor() {
        return record -> {
            if (record.amount() == null || record.amount().compareTo(BigDecimal.ZERO) < 0) {
                return null; // Filter out invalid records silently
            }
            return new ReconciledTransaction(
                    record.transactionId(),
                    record.accountId(),
                    record.amount(),
                    "PENDING",
                    "Awaiting ledger lookup"
            );
        };
    }

    @Bean
    public ItemWriter<ReconciledTransaction> batchJdbcWriter() {
        // In production: JdbcBatchItemWriter that uses addBatch()/executeBatch()
        // This simulates the batch write pattern — one call per chunk, not per item
        return chunk -> {
            System.out.printf("Committing chunk of %d items%n", chunk.size());
            for (ReconciledTransaction tx : chunk) {
                System.out.printf("  -> %s%n", tx.transactionId());
            }
        };
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Use chunk-oriented steps for any item-by-item data transformation. Use Tasklet steps (4.3) only for single-shot operations like moving a file or calling a stored procedure.',
      tone: 'green',
    },
    quiz: {
      question: 'In a chunk-oriented step with chunk size 100, how many times is the <code>ItemWriter.write()</code> method called if the step processes exactly 1,000 records?',
      options: [
        { label: '1,000 times — once per record', correct: false },
        { label: '100 times — once per chunk of 100 records', correct: false },
        { label: '10 times — the writer receives 100 items per call, repeated 10 times', correct: true },
        { label: '1 time — all records are buffered and written at the end of the step', correct: false },
      ],
      explanation: 'With 1,000 records and a chunk size of 100, the framework accumulates 100 items, then calls writer.write(chunk) once. It repeats this cycle 10 times total (1,000 / 100 = 10). The writer always receives a Chunk (a collection), never a single item. Option B is a common distractor — 100 is the chunk size, not the number of writer invocations.',
    },
  },
  {
    id: '4.2',
    title: 'Chunk Size vs. Commit Interval',
    duration: '9 min',
    kind: 'concept',
    summary: [
      'In Spring Batch, the terms <em>chunk size</em> and <em>commit interval</em> are often used interchangeably, but they are the same thing: the number of items read and processed before the writer is invoked and the transaction commits. When you call <code>.chunk(100, transactionManager)</code>, you are telling the framework: read up to 100 items, process all of them, write them as a batch, then commit the transaction. This single number is the most important performance tuning knob in your entire job, and getting it wrong is the most common cause of batch performance problems.',
      'A <strong>small chunk size</strong> (e.g., 10–50) means frequent transactions. The overhead of begin-commit-release dominates, and your database spends more time managing transactions than doing actual work. For a job processing millions of rows, a chunk size of 10 can be 10x slower than a chunk size of 500. However, small chunks have advantages: memory usage is tiny, rollback recovery is fast (you only reprocess 10 items after a crash), and you get more frequent <code>ExecutionContext</code> updates, which means finer-grained restart points. In financial reconciliation where data correctness is paramount, some teams start conservatively with 50–100 and increase only after load testing.',
      'A <strong>large chunk size</strong> (e.g., 5,000–10,000) amortizes transaction cost beautifully — one commit for thousands of rows. But it increases memory pressure because the framework holds all items in the chunk in memory until the writer flushes them. If your <code>ItemProcessor</code> enriches each record with a large object graph (e.g., loading full account details from JPA), a 10,000-item chunk can exhaust the heap. Worse, if an exception occurs on item 9,999 of a 10,000-item chunk, the entire chunk rolls back and must be re-read and re-processed on restart. The recovery cost is proportional to chunk size.',
      'For reconciliation-scale volumes — say, 50,000 to 500,000 transaction records per night — a chunk size of <strong>100 to 500</strong> is the standard starting point. Tune it by measuring: run the job with chunk sizes 100, 250, 500, and 1,000 against production-like data. Plot throughput (records per second) and memory usage. You will typically see throughput rise with chunk size up to a plateau, then flatten or decline as memory pressure or lock contention kicks in. There is no universal \'best\' chunk size — it depends on your row size, processing complexity, database lock behavior, and memory headroom. The rule is: <em>start conservative, measure, then increase</em>. Never blindly copy a chunk size from a blog post without testing it against your actual data.',
    ],
    keyPoints: [
      '<code>.chunk(N, transactionManager)</code> means N items per transaction — chunk size and commit interval are the same value.',
      'Small chunks (10–50): low memory, fast recovery, but high transaction overhead per row.',
      'Large chunks (5,000+): low transaction overhead, but high memory usage and expensive rollback recovery.',
      'For reconciliation workloads, start at <strong>100–500</strong> and tune by measuring throughput and memory.',
      'The optimal chunk size is data-dependent; never copy a value without load testing against your schema and row size.',
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
public class ChunkSizingConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public ChunkSizingConfig(JobRepository jobRepository,
                             PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job chunkSizingJob() {
        return new JobBuilder("chunkSizingJob", jobRepository)
                .start(conservativeChunkStep())
                .next(aggressiveChunkStep())
                .build();
    }

    // Conservative: 100 items per commit. Safe for memory, higher tx overhead.
    @Bean
    public Step conservativeChunkStep() {
        return new StepBuilder("conservativeChunkStep", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(100, transactionManager)
                .reader(csvReader())
                .processor(identityProcessor())
                .writer(loggingWriter())
                .build();
    }

    // Aggressive: 1,000 items per commit. Lower tx overhead, higher memory, bigger rollback window.
    @Bean
    public Step aggressiveChunkStep() {
        return new StepBuilder("aggressiveChunkStep", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(1000, transactionManager)
                .reader(csvReader())
                .processor(identityProcessor())
                .writer(loggingWriter())
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
    public ItemProcessor<TransactionRecord, ReconciledTransaction> identityProcessor() {
        return record -> new ReconciledTransaction(
                record.transactionId(),
                record.accountId(),
                record.amount(),
                "PENDING",
                "Chunk sizing test"
        );
    }

    @Bean
    public ItemWriter<ReconciledTransaction> loggingWriter() {
        return chunk -> System.out.printf(
                "Wrote chunk of %d items%n", chunk.size()
        );
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'DECISION POINT',
      text: 'If your writer uses JPA and each item loads a large entity graph, a chunk of 1,000 can hold 1,000 detached or managed entities in memory. Monitor heap usage during load testing and reduce chunk size if GC pressure rises.',
      tone: 'accent',
    },
    quiz: {
      question: 'Your job processes 1 million records with a chunk size of 10. Each transaction takes 5ms of database overhead (begin + commit). The actual read-process-write work per item takes 1ms. Approximately how much total time is spent on transaction overhead alone?',
      options: [
        { label: '5 seconds', correct: false },
        { label: '500 seconds (~8.3 minutes)', correct: true },
        { label: '50 seconds', correct: false },
        { label: '5,000 seconds (~83 minutes)', correct: false },
      ],
      explanation: '1 million records / 10 per chunk = 100,000 chunks. 100,000 chunks × 5ms transaction overhead = 500,000ms = 500 seconds (~8.3 minutes) of pure transaction overhead. The actual processing is 1 million × 1ms = 1,000 seconds. So transaction overhead alone consumes one-third of total runtime. Raising chunk size to 500 would cut transaction overhead to 10 seconds — a 50x reduction in overhead time. This is why chunk size matters.',
    },
  },
  {
    id: '4.3',
    title: 'Tasklet vs. Chunk-Oriented Steps',
    duration: '8 min',
    kind: 'concept',
    summary: [
      'Spring Batch provides two fundamentally different step types, and choosing the wrong one is a common design mistake. <strong>Chunk-oriented steps</strong> (4.1) are for item-by-item data processing: read a record, transform it, write it, repeat. <strong>Tasklet steps</strong> are for single-shot operations: do one thing, then finish. A Tasklet is a single method call — <code>execute(StepContribution, ChunkContext)</code> — that either returns <code>RepeatStatus.FINISHED</code> (done, move to next step) or <code>RepeatStatus.CONTINUABLE</code> (call me again). There is no automatic read-process-write loop, no chunk transaction boundary, and no item-level skip/retry granularity.',
      'Use a <strong>Tasklet</strong> when the work is inherently atomic and non-iterative. Canonical examples: moving a processed file from <code>/inbox</code> to <code>/archive</code> after the chunk step finishes; invoking a stored procedure that rebuilds a summary table; sending a single notification email when the job completes; executing a shell command via <code>ProcessBuilder</code> to trigger a downstream system. These are all \'do it once\' operations. A Tasklet step still runs inside a transaction (the <code>PlatformTransactionManager</code> is passed to the <code>StepBuilder</code>), but that transaction wraps the entire Tasklet execution, not a loop of items. If the Tasklet throws an exception, the whole step rolls back and restarts from the beginning — there is no mid-step resume point unless you manually manage state in the <code>ExecutionContext</code>.',
      'Use a <strong>chunk-oriented step</strong> when you have a collection of items to process, especially when the source is a file, database table, or message queue. The framework gives you restartability, skip/retry, and transaction management for free because it understands the item loop. If you try to simulate a chunk loop inside a Tasklet — reading a file line-by-line in a <code>while</code> loop, processing each line, and calling JDBC manually — you lose all of that. You must write your own transaction handling, your own restart-position tracking, your own skip logic, and your own error logging. It is possible, but it is reinventing the framework.',
      'The decision tree is simple: does the step process a <em>stream of similar items</em>? If yes, use chunk-oriented. Does the step perform a <em>single discrete action</em>? If yes, use Tasklet. A typical reconciliation job mixes both: a chunk-oriented step reads the CSV and writes to the database, followed by a Tasklet step that calls a stored procedure to update the daily summary table, followed by another Tasklet that moves the input file to an archive directory. Each step type has its place; the anti-pattern is forcing one into the other\'s job.',
    ],
    keyPoints: [
      '<strong>Chunk-oriented</strong> steps are for item-by-item data processing with automatic restartability and skip/retry.',
      '<strong>Tasklet</strong> steps are for single-shot, atomic operations (file move, stored procedure, notification).',
      'A Tasklet returns <code>RepeatStatus.FINISHED</code> (done) or <code>RepeatStatus.CONTINUABLE</code> (call again).',
      'Simulating a read-process-write loop inside a Tasklet loses framework-provided restartability, skip logic, and chunk transactions.',
      'Production jobs often mix both: chunk steps for data, Tasklet steps for orchestration and cleanup.',
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
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.FileSystemResource;
import org.springframework.transaction.PlatformTransactionManager;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Configuration
public class TaskletVsChunkConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public TaskletVsChunkConfig(JobRepository jobRepository,
                                PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job mixedTypeJob() {
        return new JobBuilder("mixedTypeJob", jobRepository)
                .start(reconcileChunkStep())
                .next(summarizeTaskletStep())
                .next(archiveFileTaskletStep())
                .build();
    }

    @Bean
    public Step reconcileChunkStep() {
        return new StepBuilder("reconcileChunkStep", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(100, transactionManager)
                .reader(csvReader())
                .processor(identityProcessor())
                .writer(batchWriter())
                .build();
    }

    @Bean
    public Step summarizeTaskletStep() {
        return new StepBuilder("summarizeTaskletStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    System.out.println("EXECUTING: CALL refresh_daily_summary()");
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }

    @Bean
    public Step archiveFileTaskletStep() {
        return new StepBuilder("archiveFileTaskletStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    Path source = Path.of("data/transactions.csv");
                    Path target = Path.of("archive/transactions_"
                            + System.currentTimeMillis() + ".csv");
                    Files.createDirectories(target.getParent());
                    Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
                    System.out.println("Archived file to: " + target);
                    return RepeatStatus.FINISHED;
                }, transactionManager)
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
    public ItemProcessor<TransactionRecord, ReconciledTransaction> identityProcessor() {
        return record -> new ReconciledTransaction(
                record.transactionId(),
                record.accountId(),
                record.amount(),
                "PENDING",
                "Tasklet vs chunk demo"
        );
    }

    @Bean
    public ItemWriter<ReconciledTransaction> batchWriter() {
        return chunk -> System.out.printf("Wrote %d reconciled records%n", chunk.size());
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'If you find yourself writing a while-loop inside a Tasklet to process a collection of records, stop. You are rebuilding chunk-oriented processing without restartability, skip logic, or granular transaction boundaries. Switch to a chunk step.',
      tone: 'accent',
    },
    quiz: {
      question: 'You need to add a step to your reconciliation job that sends a single Slack notification when the entire job completes, summarizing total matched and mismatched counts. Which step type should you use?',
      options: [
        { label: 'Chunk-oriented step with a custom ItemReader that returns one notification object', correct: false },
        { label: 'Tasklet step that reads the job ExecutionContext, formats the message, and sends one HTTP POST', correct: true },
        { label: 'Chunk-oriented step with chunk size 1', correct: false },
        { label: 'A second Job that runs after the first one finishes', correct: false },
      ],
      explanation: 'Sending a single notification is a single-shot operation — exactly what Tasklet steps are designed for. A chunk-oriented step is overkill: it would force you to model the notification as an \'item\' and run it through the read-process-write machinery. A Tasklet can read the accumulated metrics from the JobExecution\'s ExecutionContext (written by previous steps) and perform the one HTTP call. Option D adds unnecessary operational complexity — a Tasklet step inside the same job is the cleanest solution.',
    },
  },
  {
    id: '4.4',
    title: 'Chunk Transaction Mechanics',
    duration: '9 min',
    kind: 'concept',
    summary: [
      'The transaction boundary in a chunk step is precise, and misunderstanding it is the root cause of the most expensive production bugs in batch systems. Here is exactly what happens: when the framework starts a new chunk, it begins a transaction through the <code>PlatformTransactionManager</code>. It then calls <code>ItemReader.read()</code> up to <code>chunkSize</code> times, passing each item through <code>ItemProcessor.process()</code>, and accumulating the results in a list. After the last item is processed, the entire list is passed to <code>ItemWriter.write(Chunk&lt;T&gt;)</code>. Only after the writer returns successfully does the framework commit the transaction. If any exception occurs during reading, processing, or writing, the entire transaction rolls back — none of the items in that chunk are persisted.',
      'This means the writer is <em>inside</em> the transaction boundary. If your writer writes to a database <em>and</em> publishes to a Kafka topic in the same call, the database rows are protected by the rollback, but the Kafka message is already gone — it was sent non-transactionally and cannot be recalled. The database rows vanish on rollback, but the downstream consumer has already processed the message. This is the <em>two-system transactional trap</em> (see 7.5 and 10.2), and it is the most common source of data inconsistency in production batch jobs. The fix is not to avoid Spring Batch — it is to design your write step so that all side effects are either transactional (same database, same transaction manager) or idempotent (safe to repeat if the chunk is reprocessed).',
      'The transaction is managed by the <code>PlatformTransactionManager</code> passed to the <code>StepBuilder</code>. In Spring Boot 3.5, this is typically a <code>DataSourceTransactionManager</code> or <code>JpaTransactionManager</code> auto-configured from your primary <code>DataSource</code>. If your job writes to two databases, you need a <code>JtaTransactionManager</code> or you must accept that one database is not covered by the step\'s transaction. You cannot simply inject two transaction managers into one step — the <code>StepBuilder</code> accepts exactly one. This is a hard constraint: one step, one transaction boundary, one commit or rollback.',
      'Because the chunk is the rollback unit, a mid-chunk exception means all items in that chunk are re-read and re-processed on restart. This is why item processors must be <strong>stateless and idempotent</strong>: item 47 of a 100-item chunk might be processed twice if the chunk fails on item 93. If your processor increments a counter in a static field, mutates a shared cache, or calls a non-idempotent REST API, that side effect will be duplicated on restart. The processor should transform data based only on the input item and external, idempotent lookups. Any state that must survive restarts belongs in the <code>ExecutionContext</code> (2.3), not in memory.',
    ],
    keyPoints: [
      'The transaction begins before the chunk\'s first read and commits only after the writer returns successfully.',
      'A mid-chunk exception rolls back the <strong>entire chunk</strong> — no partial commits within a chunk.',
      'Non-transactional resources (Kafka, REST APIs) written inside a chunk are <strong>not protected</strong> by the rollback.',
      'The <code>StepBuilder</code> accepts exactly one <code>PlatformTransactionManager</code>; multi-resource transactions require JTA or compensating patterns.',
      'Processors must be stateless and idempotent because a failed chunk may be reprocessed from its first item on restart.',
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
public class ChunkTransactionConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public ChunkTransactionConfig(JobRepository jobRepository,
                                  PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job transactionDemoJob() {
        return new JobBuilder("transactionDemoJob", jobRepository)
                .start(transactionDemoStep())
                .build();
    }

    @Bean
    public Step transactionDemoStep() {
        return new StepBuilder("transactionDemoStep", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(50, transactionManager)
                .reader(csvReader())
                .processor(validatorProcessor())
                .writer(jdbcBatchWriter())
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
    public ItemProcessor<TransactionRecord, ReconciledTransaction> validatorProcessor() {
        return record -> {
            if (record.amount() == null) {
                throw new IllegalArgumentException(
                        "Amount is null for transaction " + record.transactionId()
                );
            }
            return new ReconciledTransaction(
                    record.transactionId(),
                    record.accountId(),
                    record.amount(),
                    "VALIDATED",
                    "Amount validated: " + record.amount()
            );
        };
    }

    @Bean
    public ItemWriter<ReconciledTransaction> jdbcBatchWriter() {
        return chunk -> {
            System.out.printf("Transaction committing chunk of %d items%n", chunk.size());
            for (ReconciledTransaction tx : chunk) {
                System.out.printf("  INSERT reconciled_transactions (%s, %s)%n",
                        tx.transactionId(), tx.reconciliationStatus());
            }
        };
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WARNING',
      text: 'Never call a non-transactional resource like a REST API or Kafka producer inside an ItemProcessor or ItemWriter unless the operation is idempotent. The chunk transaction will not roll it back, and a restart will re-execute it, causing duplicates or orphaned side effects.',
      tone: 'accent',
    },
    quiz: {
      question: 'A chunk step with size 100 is processing records. On item 73 of the chunk, the <code>ItemProcessor</code> throws a <code>NullPointerException</code>. What is the state of the first 72 items after the exception is handled by the framework?',
      options: [
        { label: 'Items 1–72 are committed to the database because they were already processed successfully', correct: false },
        { label: 'Items 1–72 are rolled back because the transaction covers the entire chunk and has not yet committed', correct: true },
        { label: 'Items 1–72 are written but marked with a FAILED status in the JobRepository', correct: false },
        { label: 'Only item 73 is skipped; the remaining 99 items are committed', correct: false },
      ],
      explanation: 'The transaction spans the entire chunk and commits only after the writer returns successfully. Since the exception occurred during processing (before the writer was even called), the transaction rolls back entirely. None of the 100 items in that chunk are persisted. This is why skip/retry policies (see 9.1) are needed if you want to isolate bad records without failing the whole chunk.',
    },
  },
  {
    id: '4.5',
    title: 'The Tasklet Interface',
    duration: '8 min',
    kind: 'concept',
    summary: [
      'The <code>Tasklet</code> interface is the contract for single-shot step execution. It has exactly one method: <code>RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext)</code>. The <code>StepContribution</code> parameter is how you report statistics back to the framework — read count, write count, skip count — because a Tasklet has no automatic item loop to track these for you. The <code>ChunkContext</code> gives you access to the <code>StepExecution</code>, which in turn provides the <code>JobExecution</code>, <code>JobParameters</code>, and both job-level and step-level <code>ExecutionContext</code> objects (see 2.3).',
      'The return value is critical. <code>RepeatStatus.FINISHED</code> tells the framework: this step is complete, move on to the next step or finish the job. <code>RepeatStatus.CONTINUABLE</code> tells the framework: call me again. The framework will keep invoking the Tasklet until it returns <code>FINISHED</code> or throws an exception. This is useful for polling scenarios: a Tasklet that checks a queue depth, processes a batch of messages, and returns <code>CONTINUABLE</code> if more messages remain. However, be careful — an infinite <code>CONTINUABLE</code> loop without a termination condition will hang the job. Always include a guard condition, such as \'return FINISHED if queue is empty\' or \'return FINISHED after 10 iterations\'.',
      'Canonical Tasklet use cases in financial reconciliation include: (1) <strong>File cleanup</strong> — moving <code>transactions.csv</code> to an archive directory after the chunk step has processed it. (2) <strong>Stored procedure invocation</strong> — calling <code>CALL rebuild_settlement_summary()</code> to refresh a materialized view after all rows are inserted. (3) <strong>System command execution</strong> — using <code>ProcessBuilder</code> to invoke a Python script that generates a PDF report from the reconciled data. (4) <strong>Notification</strong> — sending a single email or Slack message summarizing the job results. All of these are atomic, one-time actions that do not fit the read-process-write loop model.',
      'Because a Tasklet is a single method, it is also the easiest step type to unit test in isolation. You can instantiate the Tasklet, call <code>execute()</code> with a mock <code>StepContribution</code> and <code>ChunkContext</code>, and assert the result. No Spring context, no database, no item reader setup. This is in contrast to chunk-oriented steps, which require wiring readers, processors, and writers together to test meaningfully. For simple operations, the Tasklet\'s simplicity is a genuine advantage — just do not let that simplicity tempt you into cramming item-by-item logic inside it.',
    ],
    keyPoints: [
      '<code>Tasklet.execute(StepContribution, ChunkContext)</code> is the single method contract for Tasklet steps.',
      'Return <code>RepeatStatus.FINISHED</code> to end the step; <code>RepeatStatus.CONTINUABLE</code> to be called again.',
      '<code>StepContribution</code> is how you manually report read/write/skip counts to the framework.',
      '<code>ChunkContext</code> provides access to <code>StepExecution</code>, <code>JobParameters</code>, and <code>ExecutionContext</code>.',
      'Tasklets are ideal for file cleanup, stored procedures, system commands, and notifications.',
      'Tasklets are easy to unit test in isolation — no Spring context or item readers needed.',
    ],
    code: `package com.example.reconciliation.batch;

import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.core.step.tasklet.Tasklet;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Configuration
public class TaskletInterfaceConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public TaskletInterfaceConfig(JobRepository jobRepository,
                                  PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job taskletExamplesJob() {
        return new JobBuilder("taskletExamplesJob", jobRepository)
                .start(fileCleanupTasklet())
                .next(storedProcedureTasklet())
                .next(systemCommandTasklet())
                .build();
    }

    // Tasklet 1: File cleanup — single atomic operation
    @Bean
    public Step fileCleanupTasklet() {
        return new StepBuilder("fileCleanupTasklet", jobRepository)
                .tasklet(new Tasklet() {
                    @Override
                    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
                        try {
                            Path source = Path.of("data/transactions.csv");
                            Path target = Path.of("archive/transactions_"
                                    + chunkContext.getStepContext()
                                            .getJobParameters().getLong("run.id") + ".csv");
                            Files.createDirectories(target.getParent());
                            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);

                            contribution.setReadCount(1);
                            contribution.setWriteCount(1);

                            return RepeatStatus.FINISHED;
                        } catch (Exception e) {
                            throw new RuntimeException("File cleanup failed", e);
                        }
                    }
                }, transactionManager)
                .build();
    }

    // Tasklet 2: Stored procedure invocation
    @Bean
    public Step storedProcedureTasklet() {
        return new StepBuilder("storedProcedureTasklet", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    System.out.println("EXECUTING: CALL rebuild_daily_summary()");
                    contribution.setWriteCount(1);
                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }

    // Tasklet 3: System command via ProcessBuilder
    @Bean
    public Step systemCommandTasklet() {
        return new StepBuilder("systemCommandTasklet", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    try {
                        ProcessBuilder pb = new ProcessBuilder(
                                "python3", "scripts/generate_report.py",
                                chunkContext.getStepContext()
                                        .getJobParameters().getString("processDate")
                        );
                        pb.redirectErrorStream(true);
                        Process process = pb.start();

                        try (BufferedReader reader = new BufferedReader(
                                new InputStreamReader(process.getInputStream()))) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                System.out.println("[script] " + line);
                            }
                        }

                        int exitCode = process.waitFor();
                        if (exitCode != 0) {
                            throw new RuntimeException("Report script failed with exit code " + exitCode);
                        }

                        contribution.setWriteCount(1);
                        return RepeatStatus.FINISHED;
                    } catch (Exception e) {
                        throw new RuntimeException("System command failed", e);
                    }
                }, transactionManager)
                .build();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHEN TO USE',
      text: 'Use CONTINUABLE only for controlled polling with a clear termination condition. An unbounded CONTINUABLE loop will hang the job and prevent the scheduler from triggering the next instance.',
      tone: 'green',
    },
    quiz: {
      question: 'You implement a Tasklet that polls a message queue, processes up to 50 messages per call, and returns <code>RepeatStatus.CONTINUABLE</code> if the queue still has messages. What is the primary risk you must guard against?',
      options: [
        { label: 'The transaction manager will commit after each message, causing partial writes', correct: false },
        { label: 'If the queue never empties, the Tasklet will loop forever and the job will never complete', correct: true },
        { label: 'The StepContribution will overflow its integer counters', correct: false },
        { label: 'Spring Batch will create a new StepExecution for each CONTINUABLE iteration', correct: false },
      ],
      explanation: 'CONTINUABLE is powerful but dangerous: the framework will keep calling execute() until FINISHED is returned. If the queue has a steady inbound rate faster than your processing rate, the Tasklet will never return FINISHED. You must add a secondary guard — such as a maximum iteration count, a time limit, or a \'no progress made\' check — to ensure the step eventually terminates. The transaction covers the entire Tasklet call, so there is no per-message commit (option A is wrong), and counters are longs (option C is wrong). Only one StepExecution is created per step (option D is wrong).',
    },
  },
  {
    id: '4.6',
    title: 'StepContribution and Manual State Reporting',
    duration: '7 min',
    kind: 'concept',
    summary: [
      'In a chunk-oriented step, the framework automatically tracks how many items were read, processed, written, and skipped. It updates the <code>StepExecution</code> counters after each chunk and persists them to the <code>JobRepository</code>. In a Tasklet step, there is no automatic loop — you are responsible for reporting your own progress. The <code>StepContribution</code> object is how you do this. It is passed as the first argument to <code>Tasklet.execute()</code> and provides setter methods: <code>setReadCount(int)</code>, <code>setWriteCount(int)</code>, <code>setFilterCount(int)</code>, and <code>setSkipCount(int)</code>.',
      'Why does this matter? Because the <code>JobRepository</code> stores these counts in <code>BATCH_STEP_EXECUTION</code>, and they are what operators and monitoring tools use to understand job health. If your Tasklet processes 10,000 rows by calling a stored procedure but you never call <code>contribution.setWriteCount(10000)</code>, the <code>StepExecution</code> will show <code>write_count = 0</code> in the database. Your dashboard will claim the step wrote nothing, even though it successfully mutated 10,000 rows. This is not a framework bug — it is a developer oversight. The framework cannot know what your stored procedure did unless you tell it.',
      'The <code>StepContribution</code> also tracks the <code>ExitStatus</code> you can influence, though the primary way to customize exit status is through a <code>StepExecutionListener</code> (see 2.5 and 8.2). More importantly, the <code>StepContribution</code> is the mechanism for <em>manual checkpointing</em> in long-running Tasklets. If your Tasklet is polling a queue and returns <code>CONTINUABLE</code> multiple times, you can accumulate counts across calls: <code>contribution.setReadCount(contribution.getReadCount() + batchSize)</code>. This ensures the cumulative total is accurate when the step finally finishes. Without this, each iteration would overwrite the previous count.',
      'A common pattern in reconciliation jobs is a Tasklet that calls a legacy stored procedure to update a summary table. The procedure returns the number of rows affected via an output parameter. Your Tasklet should capture this value and report it: <code>contribution.setWriteCount(rowsAffected)</code>. This bridges the gap between legacy procedural code and Spring Batch\'s operational visibility. If the procedure fails, throw an exception — the transaction will roll back, and the counts will not be persisted. On restart, the step starts over, and the procedure runs again. This is correct behavior for a non-restartable Tasklet; if you need restartability, you must implement it yourself using the <code>ExecutionContext</code>.',
    ],
    keyPoints: [
      '<code>StepContribution</code> is the manual reporting API for Tasklet steps — the framework does not auto-track item counts.',
      'Set <code>readCount</code>, <code>writeCount</code>, <code>filterCount</code>, and <code>skipCount</code> so the JobRepository reflects actual work.',
      'Unreported Tasklet work appears as zero counts in <code>BATCH_STEP_EXECUTION</code>, misleading operators and dashboards.',
      'Accumulate counts across <code>CONTINUABLE</code> iterations by reading the current contribution and adding to it.',
      'For stored procedures and legacy code, capture output parameters (rows affected) and report them via StepContribution.',
    ],
    code: `package com.example.reconciliation.batch;

import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.StepContribution;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.scope.context.ChunkContext;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class StepContributionConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public StepContributionConfig(JobRepository jobRepository,
                                  PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    @Bean
    public Job reportingTaskletJob() {
        return new JobBuilder("reportingTaskletJob", jobRepository)
                .start(manualReportingStep())
                .build();
    }

    @Bean
    public Step manualReportingStep() {
        return new StepBuilder("manualReportingStep", jobRepository)
                .tasklet((StepContribution contribution, ChunkContext chunkContext) -> {
                    int rowsRead = 50000;
                    int rowsWritten = 49750;
                    int rowsFiltered = 250;

                    contribution.setReadCount(rowsRead);
                    contribution.setWriteCount(rowsWritten);
                    contribution.setFilterCount(rowsFiltered);

                    System.out.printf(
                            "Reported: read=%d, write=%d, filter=%d%n",
                            rowsRead, rowsWritten, rowsFiltered
                    );

                    return RepeatStatus.FINISHED;
                }, transactionManager)
                .build();
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WHY THIS MATTERS',
      text: 'Operators debugging a failed job at 3 AM look at BATCH_STEP_EXECUTION counts. If your Tasklet wrote 50,000 rows but reported 0, they will assume the step did nothing and may trigger a dangerous manual rerun.',
      tone: 'accent',
    },
    quiz: {
      question: 'A Tasklet calls a stored procedure that updates 10,000 rows in a summary table. The developer forgets to call any methods on <code>StepContribution</code>. After the job completes, what does <code>BATCH_STEP_EXECUTION.write_count</code> show for this step?',
      options: [
        { label: '10,000 — the framework detects the JDBC update count automatically', correct: false },
        { label: '0 — the framework has no visibility into what the Tasklet did internally', correct: true },
        { label: '1 — the framework counts the Tasklet execution itself as one write', correct: false },
        { label: 'null — the column is nullable and remains unset', correct: false },
      ],
      explanation: 'Tasklet steps have no automatic item loop. The framework cannot detect what your stored procedure, file move, or HTTP call accomplished. It initializes counters to zero and only updates them if you explicitly call setReadCount, setWriteCount, etc. via the StepContribution. This is a critical operational detail: unreported work leads to misleading dashboards and confused incident response.',
    },
  },
  {
    id: '4.7',
    title: 'When a Tasklet Quietly Becomes an Anti-Pattern',
    duration: '8 min',
    kind: 'concept',
    summary: [
      'The most dangerous anti-pattern in Spring Batch is not a complex misconfiguration — it is the innocent-looking decision to put a <code>while</code> loop inside a Tasklet. A developer needs to process a file, so they write a Tasklet that opens a <code>BufferedReader</code>, loops through lines, processes each one, and inserts into the database. It works in local testing. It passes code review because it looks simple. It deploys to production. And then it fails at 2 AM on a 5-million-row file, and the team discovers there is no restartability, no skip logic, no chunk-level transaction safety, and no way to resume from the middle of the file without rewriting the Tasklet from scratch.',
      'Here is what you lose when you simulate a chunk loop inside a Tasklet. <strong>Restartability</strong>: the framework cannot resume mid-Tasklet because a Tasklet has no persistent position tracking. If the JVM dies after 3 million rows, the next restart begins at the beginning of the Tasklet, reprocessing everything. <strong>Skip/retry granularity</strong>: in a chunk step, one bad record can be skipped after the configured limit (see 9.1). In a Tasklet loop, one bad record either fails the entire job or forces you to write custom skip logic inside the loop. <strong>Transaction boundaries</strong>: a Tasklet wraps its entire execution in one transaction. If you process 5 million rows in one Tasklet, you hold a database transaction open for hours, consuming undo log space, locking resources, and risking a catastrophic rollback. <strong>Memory safety</strong>: a Tasklet loop that accumulates all rows in a <code>List</code> before writing will exhaust the heap on large files. A chunk step never holds more than <code>chunkSize</code> items in memory.',
      'The seductive argument for Tasklet loops is often \'but the logic is too complex for a simple processor.\' This is a category error. Complexity belongs in the <code>ItemProcessor</code> or in a service layer called by the processor — not in the step type choice. If you need to process items, use a chunk step. If the processing is genuinely too complex for a single processor, use a <code>CompositeItemProcessor</code> (6.3) to chain multiple processors, or delegate to a service class. The step type is not where complexity lives; the step type is where reliability lives. Chunk steps give you reliability for free. Tasklet loops force you to rebuild it — poorly.',
      'There is one legitimate exception: when the data source itself is not item-based. For example, a Tasklet that calls a stored procedure which internally processes a cursor is fine, because the cursor iteration is inside the database, not in your Java code. The database handles its own transactions and restartability (or lack thereof). Your Tasklet is just the trigger. Similarly, a Tasklet that invokes a remote batch API which processes data on another system is fine — the item loop is not your responsibility. But if the data is in a file, a table, a queue, or a topic that you are iterating over in Java, a chunk-oriented step is the correct and only responsible choice.',
    ],
    keyPoints: [
      'A <code>while</code> loop inside a Tasklet that processes items loses restartability, skip/retry, and chunk-level transactions.',
      'A Tasklet runs as one transaction — processing millions of rows in one Tasklet holds a transaction open for hours.',
      'Memory is unbounded in a Tasklet loop; chunk steps never hold more than <code>chunkSize</code> items in memory.',
      'Complexity belongs in the <code>ItemProcessor</code> or service layer, not in the step type choice.',
      'Legitimate Tasklet use: triggering stored procedures or remote APIs that handle iteration internally.',
      'If you are iterating over a file, table, queue, or topic in Java code, use a chunk-oriented step.',
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
public class TaskletAntiPatternConfig {

    private final JobRepository jobRepository;
    private final PlatformTransactionManager transactionManager;

    public TaskletAntiPatternConfig(JobRepository jobRepository,
                                    PlatformTransactionManager transactionManager) {
        this.jobRepository = jobRepository;
        this.transactionManager = transactionManager;
    }

    // CORRECT: Chunk-oriented step for item-by-item file processing
    @Bean
    public Job correctChunkJob() {
        return new JobBuilder("correctChunkJob", jobRepository)
                .start(correctChunkStep())
                .build();
    }

    @Bean
    public Step correctChunkStep() {
        return new StepBuilder("correctChunkStep", jobRepository)
                .<TransactionRecord, ReconciledTransaction>chunk(100, transactionManager)
                .reader(csvReader())
                .processor(validationProcessor())
                .writer(batchWriter())
                .build();
    }

    // WRONG (shown as commented conceptual anti-pattern):
    // Do NOT write a Tasklet like this:
    //
    // .tasklet((contribution, chunkContext) -> {
    //     BufferedReader reader = Files.newBufferedReader(Path.of("data.csv"));
    //     String line;
    //     List<ReconciledTransaction> buffer = new ArrayList<>();
    //     while ((line = reader.readLine()) != null) {
    //         buffer.add(transform(line));
    //         // No restart position! No skip logic! One giant transaction!
    //     }
    //     jdbcTemplate.batchUpdate(buffer); // All or nothing
    //     return RepeatStatus.FINISHED;
    // }, transactionManager)

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
    public ItemProcessor<TransactionRecord, ReconciledTransaction> validationProcessor() {
        return record -> new ReconciledTransaction(
                record.transactionId(),
                record.accountId(),
                record.amount(),
                "PENDING",
                "Anti-pattern avoided"
        );
    }

    @Bean
    public ItemWriter<ReconciledTransaction> batchWriter() {
        return chunk -> System.out.printf("Wrote %d items in one chunk transaction%n", chunk.size());
    }
}`,
    codeLabel: 'java',
    note: {
      label: 'WARNING',
      text: 'If you find yourself declaring List, BufferedReader, or while-loop variables inside a Tasklet, you are almost certainly rebuilding chunk-oriented processing without the framework\'s safety guarantees. Stop and refactor to a chunk step.',
      tone: 'accent',
    },
    quiz: {
      question: 'A developer writes a Tasklet that reads a CSV file using a <code>BufferedReader</code> in a <code>while</code> loop, processes each line, and inserts rows into a database. The job runs fine on 1,000 records but fails with an OutOfMemoryError on 5 million records. What is the root cause?',
      options: [
        { label: 'The database connection pool is too small', correct: false },
        { label: 'The Tasklet accumulates all records in memory before writing, and the single transaction grows too large', correct: true },
        { label: 'Spring Batch does not support CSV files larger than 1 MB', correct: false },
        { label: 'The BufferedReader is not closed properly', correct: false },
      ],
      explanation: 'A Tasklet loop that reads all records into a List before writing has unbounded memory usage. With 5 million records, the List exhausts the heap. A chunk-oriented step with chunk size 100 would never hold more than 100 items in memory at once. Additionally, the Tasklet wraps its entire execution in one transaction, so the database must hold 5 million rows in undo log space. A chunk step commits every 100 rows, keeping memory and transaction state bounded. Option D is a secondary concern but not the root cause of OutOfMemoryError.',
    },
  },
]
