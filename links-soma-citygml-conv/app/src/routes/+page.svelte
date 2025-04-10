<script lang="ts">
	import { message } from '@tauri-apps/plugin-dialog';
	import { invoke } from '@tauri-apps/api/core';
	import { attachConsole } from '@tauri-apps/plugin-log';
	import type { SinkParameters } from '$lib/sinkparams';
	import type { TransformerRegistry } from '$lib/transformer';

	import Icon from '@iconify/svelte';
	import InputSelector from './InputSelector.svelte';
	import LoadingAnimation from './LoadingAnimation.svelte';
	import OutputSelector from './OutputSelector.svelte';
	import SettingSelector from './SettingSelector.svelte';

	attachConsole(); // For Tauri log in the webview console

	let inputPaths: string[] = [];
	let filetype: string;
	let epsg: number;
	let rulesPath = '';
	let outputPath = '';
	let sinkParameters = {} as SinkParameters;
	let isRunning = false;
	let isConvertButtonDisabled = true;

	$: isConvertButtonDisabled = !inputPaths.length || !outputPath || isRunning;
	let transformerRegistry: TransformerRegistry;

	async function convertAndSave() {
		isRunning = true;

		try {
			await invoke('run_conversion', {
				inputPaths,
				outputPath,
				filetype,
				epsg,
				rulesPath,
				transformerRegistry,
				sinkParameters
			});

			isRunning = false;
			await message(`変換が完了しました。\n'${outputPath}' に出力しました。`, { kind: 'info' });
		} catch (error: any) {
			if (error.type != 'Canceled') {
				await message(`エラーが発生しました。\n\n${error.type}: ${error.message}`, {
					title: '変換エラー',
					kind: 'error'
				});
			}
			isRunning = false;
		}
	}
</script>

{#if isRunning}
	<div class="fixed inset-0 bg-black/70 backdrop-blur-[2px] z-20 h-screen">
		<LoadingAnimation />
	</div>
{/if}

<div class="py-5 grid place-items-center h-screen">
	<div class="max-w-2xl flex flex-col gap-8 pb-4">
		<div class="flex items-center gap-1.5">
			<h1 class="font-bold text-2xl">LINKS SOMA CityGML Converter</h1>
		</div>

		<InputSelector bind:inputPaths />

		<SettingSelector
			bind:filetype
			bind:epsg
			bind:rulesPath
			bind:sinkParameters
			bind:transformerRegistry
		/>

		<OutputSelector {filetype} bind:outputPath />

		<div class="flex justify-end">
			<button
				on:click={convertAndSave}
				disabled={isConvertButtonDisabled}
				class="bg-accent1 flex items-center font-bold py-1.5 pl-3 pr-5 rounded-full gap-1 shawdow-2xl btn-color-purple custom {isConvertButtonDisabled
					? 'opacity-50'
					: ''}"
			>
				<Icon class="text-lg" icon="ic:baseline-play-arrow" />
				変換
			</button>
		</div>
	</div>
</div>
