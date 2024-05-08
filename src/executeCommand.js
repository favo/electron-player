const nodeChildProcess = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(nodeChildProcess.exec);

module.exports = {
  async executeCommand(command) {
      try {
        const { stdout, stderr } = await execAsync(command); 
        const result = {
          success: true,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        }
        return result;
      } catch (error) {
        const result = {
          success: false,
          stdout: null,
          stderr: null,
          error: error
        }
        return result
      }
  }
}