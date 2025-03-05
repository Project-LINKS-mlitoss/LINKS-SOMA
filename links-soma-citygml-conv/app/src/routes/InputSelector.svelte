<script lang="ts">
	import {} from '@tauri-apps/api';
	import Icon from '@iconify/svelte';
	import { abbreviatePath } from '$lib/utils';
	import * as dialog from '@tauri-apps/plugin-dialog';
	import * as fs from '@tauri-apps/plugin-fs';
	import * as path from '@tauri-apps/api/path';
	import { unzip } from 'fflate';
	import { invoke } from '@tauri-apps/api/core';

	// let isFolderMode = true;
	let isFolderMode = import.meta.env.VITE_TEST_INPUT_PATH ? false : true;
	let isZipMode = false;
	let isLoadingUnZip = false;
	let inputDirectories: string[] = [];
	export let inputPaths: string[] = [];

	// Clear the inputs when the mode changes
	$: if (isFolderMode || !isFolderMode || isZipMode || !isZipMode) {
		inputDirectories = [];
		inputPaths = import.meta.env.VITE_TEST_INPUT_PATH ? [import.meta.env.VITE_TEST_INPUT_PATH] : [];
		isLoadingUnZip = false
	}

	async function openDirectoryDialog() {
		const res = await dialog.open({
			multiple: true,
			directory: true
		});
		if (!res) return;

		inputDirectories = Array.isArray(res) ? res : [res];
		let pathPromises: Promise<string>[] = [];
		for (const directory of inputDirectories) {
			const files = await fs.readDir(directory);
			const gmlFiles = files.filter((d) => d.isFile && d.name?.endsWith('.gml'));
			pathPromises = pathPromises.concat(gmlFiles.map(async (d) => path.join(directory, d.name)));
		}
		inputPaths = await Promise.all(pathPromises);

		if (inputPaths.length === 0) {
			await dialog.message('選択したフォルダにGMLファイルが含まれていません', {
				kind: 'warning'
			});
			inputDirectories = [];
		}
	}

	function getTimestamp() {
		const timestamp = new Date().toISOString().split('T')[0].replaceAll("-", "");
		return `linksoma${timestamp}`;
	}

	const chunkArray = <T>(arr: T[], size: number): T[][] => {
		return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
			arr.slice(i * size, i * size + size)
		);
	};

	const writeFilesInChunks = async (selectedFiles: Record<string, ArrayBufferLike>, targetDir: string) => {
		const fileEntries = Object.entries(selectedFiles);
		const fileChunks = chunkArray(fileEntries, 10);

		for (const chunk of fileChunks) {
			const writePromises = chunk.map(async ([filename, fileData]) => {
				const fileNameOnly = filename.split("/").pop() || filename;
				const filePath = await path.join(targetDir, fileNameOnly);
				await fs.writeFile(filePath, new Uint8Array(fileData as ArrayBufferLike));
			});

			await Promise.all(writePromises);
		}
	};

	async function openZipDialog() {
		isLoadingUnZip = true;
		let res = await dialog.open({
			multiple: false,
			directory: false,
			filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
		});

		if (!res) {
			isLoadingUnZip = false;
			return;
		}

		const zipPath = Array.isArray(res) ? res[0] : res;
		const tempDir = await path.tempDir();
		const timestamp = getTimestamp();
		const outputDir = await path.join(tempDir, timestamp);

		try {
			const gmlFiles: string[] = await invoke("unzip_file", { zipPath, outputDir });
			if (gmlFiles.length === 0) {
				await dialog.message("フォルダ「udx/bldg」,「udx/luse」,「udx/urf」にGMLファイルが含まれていません", {
					kind: "warning",
				});
			} else {
				inputPaths = gmlFiles;
			}
		} catch (error) {
			console.error("Error extracting ZIP:", error);
			await dialog.message("ZIPファイルの解凍中にエラーが発生しました", { kind: "error" });
		} finally {
			isLoadingUnZip = false;
		}
	}


	async function openFileDialog() {
		const res = await dialog.open({
			multiple: true,
			directory: false,
			filters: [
				{
					name: 'CityGML',
					extensions: ['gml']
				}
			]
		});
		if (!res) return;
		inputPaths = Array.isArray(res) ? res : [res];
	}

	function clearSelected() {
		inputDirectories = [];
		inputPaths = [];
	}

	function onChangeMode(mode: string) {
		// isLoadingUnZip = false
		if (mode == "zip") {
			isZipMode = true;
			isFolderMode = false;
		} else {
			isZipMode = false;
			if (mode == "folder") {
				isFolderMode = true;
			} else {
				isFolderMode = false;
			}
		}
	}

	function openModal() {
		if (!isLoadingUnZip) {
			if (isFolderMode) {
				openDirectoryDialog();
			} else if (isZipMode) {
				clearSelected();
				openZipDialog();
			} else {
				openFileDialog();	
			}
		}
	}
</script>

<div>
	<div class="flex items-center gap-1.5">
		<Icon class="text-xl" icon="material-symbols:input-rounded" />
		<h2 class="font-bold text-xl">入力</h2>
	</div>
	<hr class="mt-0.5" />

	<div class="ml-3">
		<div>
			<span class="isolate inline-flex rounded-md my-3">
				<button
					type="button"
					class="relative inline-flex btn-color-purple gap-1 items-center rounded-l-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
					class:active={isFolderMode && !isZipMode}
					on:click={() => onChangeMode("folder")}
					><Icon icon="material-symbols:folder" />フォルダ選択</button
				>
				<button
					type="button"
					class="relative inline-flex btn-color-purple gap-1 items-center rounded-l-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
					class:active={isZipMode}
					on:click={() => onChangeMode("zip")}
					><Icon icon="material-symbols:folder-zip" />ZIP</button
				>
				<button
					type="button"
					class="relative -ml-px inline-flex btn-color-purple gap-1 items-center rounded-r-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
					class:active={!isFolderMode && !isZipMode}
					on:click={() => onChangeMode("file")}><Icon icon="ph:files" />ファイル選択</button
				>
			</span>
		</div>

		<div class="flex items-center gap-3">
			<button
				on:click={openModal}
				class="bg-accent1 btn-color-purple custom font-semibold rounded px-4 py-0.5 shadow hover:opacity-75">選択</button
			>
			<div class="text-sm">
				{#if isFolderMode}
					{#if inputDirectories.length === 0}
						<p class="text-red-400">フォルダが選択されていません</p>
					{:else}
						<div class="flex items-center gap-1">
							<p>
								<b>{inputDirectories.length}</b> フォルダ （計 <b>{inputPaths.length}</b> GMLファイル）
							</p>
							<button class="tooltip hover:text-accent1">
								<Icon class="text-2xl" icon="material-symbols-light:list-alt-rounded" />
								<div class="tooltip-text max-h-64 overflow-y-auto">
									<ol>
										{#each inputDirectories as folder}
											<li class="text-xs">{abbreviatePath(folder, 30)}</li>
										{/each}
									</ol>
								</div>
							</button>
							<button on:click={clearSelected} class="hover:opacity-75">
								<Icon icon="material-symbols:cancel" />
							</button>
						</div>
					{/if}
				{:else if isZipMode}
					{#if isLoadingUnZip}
						<div class="flex items-center gap-1">
							<p>
								Loading...
							</p>
						</div>
					{:else if inputPaths.length === 0}
						<p class="text-red-400">ファイルが選択されていません</p>
					{:else}
						<div class="flex items-center gap-1">
							<p>
								計 <b>{inputPaths.length}</b> GMLファイル
							</p>
							<button on:click={clearSelected} class="hover:opacity-75">
								<Icon icon="material-symbols:cancel" />
							</button>
						</div>
					{/if}
				{:else if inputPaths.length === 0}
					<p class="text-red-400">ファイルが選択されていません</p>
				{:else}
					<div class="flex items-center gap-1">
						<p><b>{inputPaths.length}</b> ファイル</p>
						<button class="tooltip hover:text-accent1">
							<Icon class="text-2xl" icon="material-symbols-light:list-alt-rounded" />
							<div class="tooltip-text max-h-64 overflow-y-auto">
								<ol>
									{#each inputPaths as path}
										<li class="text-xs">{abbreviatePath(path, 30)}</li>
									{/each}
								</ol>
							</div>
						</button>
						<button on:click={clearSelected} class="hover:opacity-75">
							<Icon icon="material-symbols:cancel" />
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style lang="postcss">
	.active {
		@apply bg-accent1;
		pointer-events: none;
	}

	ol {
		@apply pl-4;
		@apply list-decimal;
	}

	.tooltip {
		position: relative;
		cursor: pointer;
	}

	.tooltip-text {
		opacity: 0;
		visibility: hidden;
		position: absolute;
		left: 50%;
		transform: translateX(-50%) translateY(100%);
		bottom: 0px;
		display: inline-block;
		white-space: nowrap;
		@apply text-left;
		@apply px-6 py-2;
		@apply bg-white text-base border rounded shadow;
		transition: 0.3s ease-in;
		z-index: 10;
	}

	.tooltip:hover .tooltip-text {
		opacity: 1;
		visibility: visible;
	}
</style>
