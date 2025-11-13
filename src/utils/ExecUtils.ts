/**
 * Utility functions for executing shell commands
 */
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class ExecUtils {
  /**
   * Execute a shell command and return the result
   */
  static async execute(command: string): Promise<{ stdout: string; stderr: string }> {
    return execAsync(command);
  }

  /**
   * Check if a process is running by PID (Windows)
   */
  static async isProcessRunning(pid: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" 2>&1`);
      return stdout.includes(`${pid}`) && !stdout.includes("INFO: No tasks");
    } catch {
      return false;
    }
  }

  /**
   * Test if a port is accessible (Windows)
   */
  static async isPortAccessible(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `powershell -Command "Test-NetConnection -ComputerName localhost -Port ${port} -InformationLevel Quiet" 2>&1`
      );
      return stdout.includes("True") || stdout.trim() === "True";
    } catch {
      return false;
    }
  }

  /**
   * Find the path to a command in PATH
   */
  static async findCommand(command: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`where ${command} 2>&1`);
      const path = stdout.trim().split("\n")[0];
      if (path && !path.includes("not found") && !path.includes("Could not find")) {
        return path;
      }
      return null;
    } catch {
      return null;
    }
  }
}

