# LINKS-SOMA-CityGML-Converter

## development

```
cd ./app
```

### Install package

```
npm install
```

### RUN dev
```
npx tauri dev
```

## Build

```
cd ./app
```

### RUN build 
```
npx tauri build
```

### RUN build option x86_64-pc-windows-msvc
```
npx tauri build --target x86_64-pc-windows-msvc
```

### Optimize (Ultimate Packer for eXecutables)
```
cd ./target/x86_64-pc-windows-msvc/release
```

OR

```
cd ./target/release
```

#### Optimize
```
upx --best --lzma LINKS_SOMA_CityGML_Converter.exe
```