'use strict';
import { Iterables } from '../system';
import { commands, Range, TextDocumentShowOptions, TextEditor, Uri, window } from 'vscode';
import { ActiveEditorCommand, Commands, getCommandUri } from './common';
import { Container } from '../container';
import { DiffWithCommandArgs } from './diffWith';
import { GitLogCommit, GitService, GitStatusFile, GitUri } from '../gitService';
import { Logger } from '../logger';
import { Messages } from '../messages';

export interface DiffWithNextCommandArgs {
    commit?: GitLogCommit;
    range?: Range;

    line?: number;
    showOptions?: TextDocumentShowOptions;
}

export class DiffWithNextCommand extends ActiveEditorCommand {

    constructor() {
        super(Commands.DiffWithNext);
    }

    async execute(editor?: TextEditor, uri?: Uri, args: DiffWithNextCommandArgs = {}): Promise<any> {
        uri = getCommandUri(uri, editor);
        if (uri == null) return undefined;

        args = { ...args };
        if (args.line === undefined) {
            args.line = editor == null ? 0 : editor.selection.active.line;
        }

        const gitUri = await GitUri.fromUri(uri);
        let status: GitStatusFile | undefined;

        if (args.commit === undefined || !(args.commit instanceof GitLogCommit) || args.range !== undefined) {
            try {
                const sha = args.commit === undefined ? gitUri.sha : args.commit.sha;

                if (GitService.isStagedUncommitted(sha!)) {
                    const diffArgs: DiffWithCommandArgs = {
                        repoPath: gitUri.repoPath!,
                        lhs: {
                            sha: sha!,
                            uri: gitUri
                        },
                        rhs: {
                            sha: '',
                            uri: gitUri
                        },
                        line: args.line,
                        showOptions: args.showOptions
                    };
                    return commands.executeCommand(Commands.DiffWith, diffArgs);
                }

                const log = await Container.git.getLogForFile(gitUri.repoPath, gitUri.fsPath, { maxCount: sha !== undefined ? undefined : 2, range: args.range!, renames: true });
                if (log === undefined) return Messages.showFileNotUnderSourceControlWarningMessage('Unable to open compare');

                args.commit = (sha && log.commits.get(sha)) || Iterables.first(log.commits.values());

                // If the sha is missing or the file is uncommitted, treat it as a DiffWithWorking
                if (gitUri.sha === undefined) {
                    status = await Container.git.getStatusForFile(gitUri.repoPath!, gitUri.fsPath);
                    if (status !== undefined) return commands.executeCommand(Commands.DiffWithWorking, uri);
                }
            }
            catch (ex) {
                Logger.error(ex, 'DiffWithNextCommand', `getLogForFile(${gitUri.repoPath}, ${gitUri.fsPath})`);
                return window.showErrorMessage(`Unable to open compare. See output channel for more details`);
            }
        }

        if (args.commit.nextSha === undefined) {
            // Check if the file is staged
            status = status || await Container.git.getStatusForFile(gitUri.repoPath!, gitUri.fsPath);
            if (status !== undefined && status.indexStatus === 'M') {
                const diffArgs: DiffWithCommandArgs = {
                    repoPath: args.commit.repoPath,
                    lhs: {
                        sha: args.commit.sha,
                        uri: args.commit.uri
                    },
                    rhs: {
                        sha: GitService.stagedUncommittedSha,
                        uri: args.commit.uri
                    },
                    line: args.line,
                    showOptions: args.showOptions
                };

                return commands.executeCommand(Commands.DiffWith, diffArgs);
            }

            return commands.executeCommand(Commands.DiffWithWorking, uri);
        }

        const diffArgs: DiffWithCommandArgs = {
            repoPath: args.commit.repoPath,
            lhs: {
                sha: args.commit.sha,
                uri: args.commit.uri
            },
            rhs: {
                sha: args.commit.nextSha,
                uri: args.commit.nextUri
            },
            line: args.line,
            showOptions: args.showOptions
        };
        return commands.executeCommand(Commands.DiffWith, diffArgs);
    }
}