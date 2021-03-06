'use strict';
import { Iterables } from '../system';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CommitFileNode, CommitFileNodeDisplayAs } from './commitFileNode';
import { Container } from '../container';
import { Explorer, ExplorerNode, MessageNode, ResourceType } from './explorerNode';
import { GitCommitType, GitLogCommit, GitService, GitUri, Repository, RepositoryChange, RepositoryChangeEvent } from '../gitService';
import { Logger } from '../logger';

export class FileHistoryNode extends ExplorerNode {

    constructor(
        uri: GitUri,
        private readonly repo: Repository,
        private readonly explorer: Explorer
    ) {
        super(uri);
    }

    async getChildren(): Promise<ExplorerNode[]> {
        this.updateSubscription();

        const children: ExplorerNode[] = [];

        const displayAs = CommitFileNodeDisplayAs.CommitLabel | (this.explorer.config.avatars ? CommitFileNodeDisplayAs.Gravatar : CommitFileNodeDisplayAs.StatusIcon);

        const status = await Container.git.getStatusForFile(this.uri.repoPath!, this.uri.fsPath);
        if (status !== undefined && (status.indexStatus !== undefined || status.workTreeStatus !== undefined)) {
            let sha;
            let previousSha;
            if (status.workTreeStatus !== undefined) {
                sha = GitService.uncommittedSha;
                if (status.indexStatus !== undefined) {
                    previousSha = GitService.stagedUncommittedSha;
                }
                else if (status.workTreeStatus !== '?') {
                    previousSha = 'HEAD';
                }
            }
            else {
                sha = GitService.stagedUncommittedSha;
                previousSha = 'HEAD';
            }

            const commit = new GitLogCommit(
                GitCommitType.File,
                this.uri.repoPath!,
                sha,
                'You',
                undefined,
                new Date(),
                '',
                status.fileName,
                [status],
                status.status,
                status.originalFileName,
                previousSha,
                status.originalFileName || status.fileName);
            children.push(new CommitFileNode(status, commit, this.explorer, displayAs));
        }

        const log = await Container.git.getLogForFile(this.uri.repoPath, this.uri.fsPath, { ref: this.uri.sha });
        if (log !== undefined) {
            children.push(...Iterables.map(log.commits.values(), c => new CommitFileNode(c.fileStatuses[0], c, this.explorer, displayAs)));
        }

        if (children.length === 0) return [new MessageNode('No file history')];
        return children;
    }

    getTreeItem(): TreeItem {
        this.updateSubscription();

        const item = new TreeItem(`${this.uri.getFormattedPath()}`, TreeItemCollapsibleState.Expanded);
        item.contextValue = ResourceType.FileHistory;
        item.tooltip = `History of ${this.uri.getFilename()}\n${this.uri.getDirectory()}/`;

        item.iconPath = {
            dark: Container.context.asAbsolutePath('images/dark/icon-history.svg'),
            light: Container.context.asAbsolutePath('images/light/icon-history.svg')
        };

        return item;
    }

    private updateSubscription() {
        this.disposable = this.disposable || this.repo.onDidChange(this.onRepoChanged, this);
    }

    private onRepoChanged(e: RepositoryChangeEvent) {
        if (!e.changed(RepositoryChange.Repository)) return;

        Logger.log(`FileHistoryNode.onRepoChanged(${e.changes.join()}); triggering node refresh`);

        this.explorer.refreshNode(this);
    }
}