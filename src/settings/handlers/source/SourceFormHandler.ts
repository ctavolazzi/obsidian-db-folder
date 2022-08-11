import { DatabaseView } from "DatabaseView";
import { SourceDataTypes } from "helpers/Constants";
import { generateDataviewTableQuery } from "helpers/QueryHelper";
import { Notice, Setting } from "obsidian";
import { DataviewService } from "services/DataviewService";
import { AbstractSettingsHandler, SettingHandlerResponse } from "settings/handlers/AbstractSettingHandler";
import { add_dropdown } from "settings/SettingsComponents";
import { FileSuggest } from "settings/suggesters/FileSuggester";

export class SourceFormHandler extends AbstractSettingsHandler {
    settingTitle: string = 'Form in function of source data';
    handle(settingHandlerResponse: SettingHandlerResponse): SettingHandlerResponse {
        const { containerEl, view } = settingHandlerResponse;
        switch (view.diskConfig.yaml.config.source_data) {
            case SourceDataTypes.TAG:
                tagHandler(view, containerEl);
                break;
            case SourceDataTypes.OUTGOING_LINK:
            case SourceDataTypes.INCOMING_LINK:
                const filePaths: Record<string, string> = {}
                app.vault.getMarkdownFiles().forEach(file => { filePaths[file.path] = file.basename });
                const source_form_promise = async (value: string): Promise<void> => {
                    // update settings
                    view.diskConfig.updateConfig({ source_form_result: value });
                };
                new Setting(containerEl)
                    .setName('Select a file')
                    .setDesc('Select file from vault to be used as source of data.')
                    .addSearch((cb) => {
                        new FileSuggest(
                            cb.inputEl,
                            view.file.parent.path
                        );
                        cb.setPlaceholder("Example: folder1/template_file")
                            .setValue(view.diskConfig.yaml.config.source_form_result)
                            .onChange(source_form_promise);
                    });
                break;
            case SourceDataTypes.QUERY:
                queryHandler(view, containerEl);
            default:
            //Current folder
        }

        return this.goNext(settingHandlerResponse);
    }
}

function tagHandler(view: DatabaseView, containerEl: HTMLElement) {
    const tagArray: Record<string, number> = (app.metadataCache as unknown as any).getTags();
    if (tagArray) {
        const tagRecords: Record<string, string> = {};
        // Order tagRecord by key (tag name)
        Object.entries(tagArray)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([key, value]) => {
                tagRecords[key] = `${key}(${value})`;
            });
        const source_form_promise = async (value: string): Promise<void> => {
            // update settings
            view.diskConfig.updateConfig({ source_form_result: value.slice(1) });
        };

        add_dropdown(
            containerEl,
            'Select a tag',
            'Select tag to get data from',
            `#${view.diskConfig.yaml.config.source_form_result}`,
            tagRecords,
            source_form_promise
        );
    }
}

function queryHandler(view: DatabaseView, containerEl: HTMLElement) {
    const query_promise = async (value: string): Promise<void> => {
        // update settings
        view.diskConfig.yaml.config.source_form_result = value;
        view.diskConfig.updateConfig({ source_form_result: value });
    };
    new Setting(containerEl)
        .setName('Dataview query')
        .setDesc('Enter a dataview query starting with FROM (the plugin autocomplete the query with TABLE & the column fields)')
        .addTextArea((textArea) => {
            textArea.setValue(view.diskConfig.yaml.config.source_form_result);
            textArea.setPlaceholder('Write here your dataview query...');
            textArea.onChange(query_promise);
        }).addExtraButton((cb) => {
            cb.setIcon("check")
                .setTooltip("Validate query")
                .onClick(async (): Promise<void> => {
                    const query = generateDataviewTableQuery(
                        view.diskConfig.yaml.columns,
                        view.diskConfig.yaml.config.source_form_result);
                    if (query) {
                        DataviewService.getDataviewAPI().tryQuery(query)
                            .then(() => {
                                new Notice(`Dataview query "${query}" is valid!`, 2000);
                            })
                            .catch((e) => {
                                new Notice(`Dataview query "${query}" is invalid: ${e.message}`, 10000);
                            });
                    }
                });
        });
}