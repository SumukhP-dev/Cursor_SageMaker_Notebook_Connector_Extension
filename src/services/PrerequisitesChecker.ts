/**
 * Service for checking all prerequisites required for SageMaker connection
 */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ExecUtils } from "../utils/ExecUtils";
import { PrerequisitesResult, RemoteSSHExtension } from "../types";

export class PrerequisitesChecker {
  /**
   * Check all prerequisites and return structured results
   */
  static async checkAll(): Promise<PrerequisitesResult> {
    const errors: string[] = [];

    // Check AWS CLI
    const awsCli = await this.checkAWSCLI();
    if (!awsCli) {
      errors.push("AWS CLI not found");
    }

    // Check Session Manager Plugin
    const sessionManagerPlugin = await this.checkSessionManagerPlugin();
    if (!sessionManagerPlugin) {
      errors.push("Session Manager Plugin not found");
    }

    // Check Remote-SSH extension
    const remoteSSH = await this.checkRemoteSSHExtension();
    const remoteSSHInstalled = remoteSSH.installed;

    // Check SSH config
    const sshConfig = await this.checkSSHConfig();

    // Check AWS Toolkit
    const awsToolkit = await this.checkAWSToolkit();

    return {
      allPassed: errors.length === 0 && remoteSSHInstalled && sshConfig,
      awsCli,
      sessionManagerPlugin,
      remoteSSH: remoteSSHInstalled,
      sshConfig,
      awsToolkit,
      errors,
    };
  }

  /**
   * Check if AWS CLI is installed
   */
  private static async checkAWSCLI(): Promise<boolean> {
    try {
      await ExecUtils.execute("aws --version");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Session Manager Plugin is installed
   */
  private static async checkSessionManagerPlugin(): Promise<boolean> {
    const pluginPath =
      "C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin\\session-manager-plugin.exe";
    if (fs.existsSync(pluginPath)) {
      return true;
    }

    try {
      await ExecUtils.execute("session-manager-plugin --version");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Remote-SSH extension is installed (supports both VS Code and Cursor)
   */
  static async checkRemoteSSHExtension(): Promise<RemoteSSHExtension> {
    const remoteSSH_VSCode = vscode.extensions.getExtension(
      "ms-vscode-remote.remote-ssh"
    );
    const remoteSSH_Cursor = vscode.extensions.getExtension(
      "anysphere.remote-ssh"
    );

    if (remoteSSH_Cursor) {
      return {
        installed: true,
        type: "cursor",
        extensionId: "anysphere.remote-ssh",
      };
    } else if (remoteSSH_VSCode) {
      return {
        installed: true,
        type: "vscode",
        extensionId: "ms-vscode-remote.remote-ssh",
      };
    } else if (remoteSSH_VSCode) {
      return {
        installed: true,
        type: "vscode",
        extensionId: "ms-vscode-remote.remote-ssh",
      };
    }

    return {
      installed: false,
      type: "none",
      extensionId: null,
    };
  }

  /**
   * Check if SSH config exists and contains SageMaker host
   */
  private static async checkSSHConfig(): Promise<boolean> {
    const sshConfigPath = path.join(
      process.env.USERPROFILE || "",
      ".ssh",
      "config"
    );
    if (fs.existsSync(sshConfigPath)) {
      const configContent = fs.readFileSync(sshConfigPath, "utf8");
      return configContent.includes("Host sagemaker");
    }
    return false;
  }

  /**
   * Check if AWS Toolkit extension is installed
   */
  private static async checkAWSToolkit(): Promise<boolean> {
    return (
      vscode.extensions.getExtension("amazonwebservices.aws-toolkit-vscode") !==
      undefined
    );
  }
}

