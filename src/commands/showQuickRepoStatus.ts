'use strict';
import { TextEditor, Uri, window } from 'vscode';
import { ActiveEditorCachedCommand, Commands, getCommandUri, getRepoPathOrActiveOrPrompt } from './common';
import { GlyphChars } from '../constants';
import { Container } from '../container';
import { Logger } from '../logger';
import { CommandQuickPickItem, RepoStatusQuickPick } from '../quickPicks/quickPicks';

export interface ShowQuickRepoStatusCommandArgs {
    goBackCommand?: CommandQuickPickItem;
}

export class ShowQuickRepoStatusCommand extends ActiveEditorCachedCommand {

    constructor() {
        super(Commands.ShowQuickRepoStatus);
    }

    async execute(editor?: TextEditor, uri?: Uri, args: ShowQuickRepoStatusCommandArgs = {}) {
        uri = getCommandUri(uri, editor);

        try {
            const repoPath = await getRepoPathOrActiveOrPrompt(uri, editor, `Show status for which repository${GlyphChars.Ellipsis}`);
            if (!repoPath) return undefined;

            const status = await Container.git.getStatusForRepo(repoPath);
            if (status === undefined) return window.showWarningMessage(`Unable to show repository status`);

            const pick = await RepoStatusQuickPick.show(status, args.goBackCommand);
            if (pick === undefined) return undefined;

            if (pick instanceof CommandQuickPickItem) return pick.execute();

            return undefined;
        }
        catch (ex) {
            Logger.error(ex, 'ShowQuickRepoStatusCommand');
            return window.showErrorMessage(`Unable to show repository status. See output channel for more details`);
        }
    }
}