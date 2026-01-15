/**
 * Worker Main Entry
 * Handles media task processing from QStash queue
 */

import express from 'express';
import { processMediaTask } from './process-task';

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'media-worker',
  });
});

// Process task endpoint (called by QStash)
app.post('/api/worker/process', async (req, res) => {
  try {
    const { taskId, url, outputType, userId } = req.body;

    // Validate request
    if (!taskId || !url || !outputType || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: taskId, url, outputType, userId',
      });
    }

    // Immediately return 200 to QStash to prevent retries
    // The actual processing happens asynchronously
    res.status(200).json({
      received: true,
      taskId,
      message: 'Task received, processing started',
    });

    // Start async processing (don't await)
    processMediaTask(taskId, url, outputType, userId).catch((error) => {
      console.error('[Worker Task Failed]', {
        taskId,
        url,
        outputType,
        userId,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error: any) {
    console.error('[Worker Request Error]', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Worker] Server listening on port ${PORT}`);
  console.log(`[Worker] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Worker] Health check: http://localhost:${PORT}/health`);
});



