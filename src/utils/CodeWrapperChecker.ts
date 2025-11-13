/**
 * Utility for checking code command wrapper issues
 */
import { ExecUtils } from "./ExecUtils";
import * as path from "path";
import { CodeWrapperIssue } from "../types";

export class CodeWrapperChecker {
  /**
   * Check if there are any issues with the code command wrapper
   */
  static async checkCodeWrapperIssue(): Promise<CodeWrapperIssue> {
    try {
      const codePath = await ExecUtils.findCommand("code");

      if (!codePath) {
        return {
          hasIssue: true,
          message: "Code command not found in PATH. AWS Toolkit can't start the server.",
        };
      }

      // Check if it points to Cursor or VS Code
      if (codePath.toLowerCase().includes("cursor")) {
        // Good - points to Cursor
        // Test if it handles --folder-uri correctly
        try {
          // This will fail, but we want to see the error
          await ExecUtils.execute('code --folder-uri "vscode-remote://test" 2>&1');
        } catch (testError: any) {
          const errorMsg = testError.message || testError.stderr || "";
          if (
            errorMsg.includes("bad option") ||
            errorMsg.includes("--folder-uri")
          ) {
            return {
              hasIssue: true,
              message:
                "Code wrapper doesn't handle --folder-uri flag correctly. Cursor doesn't support this flag.",
            };
          }
        }

        return {
          hasIssue: false,
          message: "Code wrapper appears to be working correctly.",
        };
      } else if (
        codePath.toLowerCase().includes("code.exe") ||
        codePath.toLowerCase().includes("vs code")
      ) {
        return {
          hasIssue: true,
          message:
            "Code command points to VS Code instead of Cursor. AWS Toolkit will open VS Code instead of Cursor.",
        };
      }
    } catch {
      return {
        hasIssue: true,
        message:
          "Could not verify code command. It may not be in PATH or configured correctly.",
      };
    }

    return {
      hasIssue: false,
      message: "Code wrapper appears to be configured correctly.",
    };
  }

  /**
   * Get the expected Cursor executable path
   */
  static getCursorExePath(): string {
    return path.join(
      process.env.LOCALAPPDATA || "",
      "Programs",
      "cursor",
      "Cursor.exe"
    );
  }
}

