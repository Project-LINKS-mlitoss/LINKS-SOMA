#!/usr/bin/env bash
#
# PMTiles ビルドスクリプト
#
# 使い方:
#   ./basemap/build.sh                             # 全地域ビルド
#   ./basemap/build.sh --region kanto              # 関東のみ
#   ./basemap/build.sh --region kanto --region chubu  # 複数地域
#   ./basemap/build.sh --skip-jar --region kanto   # JARビルドスキップ（2回目以降）
#
# 前提条件:
#   - Java 21+
#   - Maven 3.x
#   - git
#   - pmtiles CLI（任意、検証ステップで使用）
#
# 詳細: docs/guides/basemap-build.md

set -euo pipefail

# ==============================================================================
# 定数
# ==============================================================================

# Protomaps Basemaps リポジトリ
BASEMAPS_REPO="https://github.com/protomaps/basemaps.git"

# Protomaps Basemaps のコミットハッシュ
# PR #413 "Use planetiler releases instead of snapshots" (2025-03-08) のマージコミット
#
# 経緯:
#   - 現在のPMTilesは Planetiler 0.8.4-SNAPSHOT で生成されている（pmtiles show で確認）
#   - しかし 0.8.4-SNAPSHOT はSonatype Snapshotsリポジトリから削除済みでビルド不可
#   - PR #412 で 0.8.5 に更新、PR #413 でSNAPSHOT依存からリリース版依存に切り替え
#   - このコミットは Planetiler 0.8.5（リリース版）を使用する
#
# 注意:
#   - 現在のPMTilesを生成した正確なbasemapsリポのコミットは不明
#     （planetiler:githash はPlanetiler本体のハッシュであり、basemapsリポのコミットではない）
#   - Planetiler 0.8.4-SNAPSHOT → 0.8.5 の差異があるため、
#     ビルド後に pmtiles show で version と source-layer 名を必ず検証すること
BASEMAPS_COMMIT="55eb9951b81d7e3dd474237bddb647318ba0b12b"

# ビルドパラメータ（現在のPMTilesメタデータから取得した値）
ZOOM_MIN=0
ZOOM_MAX=15

# JVMヒープサイズ（地域単位ビルドの推奨値）
JAVA_HEAP="${JAVA_HEAP:-8g}"

# 地域定義
# 地域名は build.yml の matrix.region と一致
# Planetiler の --area にはプレフィックスなしの地域名を渡す
# （Planetiler が Geofabrik インデックスから自動検索する）
ALL_REGIONS="hokkaido tohoku kanto chubu kansai chugoku shikoku kyushu"

# 地域名 → Planetiler --area 値の変換
get_area() {
  case "$1" in
    hokkaido) echo "hokkaido" ;;
    tohoku)   echo "tohoku" ;;
    kanto)    echo "kanto" ;;
    chubu)    echo "chubu" ;;
    kansai)   echo "kansai" ;;
    chugoku)  echo "chugoku" ;;
    shikoku)  echo "shikoku" ;;
    kyushu)   echo "kyushu" ;;
    *)        echo "" ;;
  esac
}

# protomaps-basemaps.json が参照する source-layer 名（検証用）
REQUIRED_SOURCE_LAYERS="earth landcover landuse roads water buildings boundaries pois places"

# ディレクトリ（スクリプトのあるディレクトリを基準）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASEMAPS_DIR="${SCRIPT_DIR}/basemaps"
OUTPUT_DIR="${SCRIPT_DIR}/output"

# ==============================================================================
# ユーティリティ関数
# ==============================================================================

log_info() {
  echo "[INFO] $*"
}

log_warn() {
  echo "[WARN] $*" >&2
}

log_error() {
  echo "[ERROR] $*" >&2
}

# ==============================================================================
# 前提条件チェック
# ==============================================================================

check_prerequisites() {
  log_info "前提条件を確認中..."

  # Java
  if ! command -v java &>/dev/null; then
    log_error "java が見つかりません。Java 21+ をインストールしてください。"
    exit 1
  fi

  local java_version
  java_version=$(java -version 2>&1 | head -1 | sed -E 's/.*"([0-9]+)\..*/\1/')
  if [[ "${java_version}" -lt 21 ]]; then
    log_error "Java 21+ が必要です（現在: ${java_version}）"
    exit 1
  fi
  log_info "Java ${java_version} — OK"

  # Maven
  if ! command -v mvn &>/dev/null; then
    log_error "mvn が見つかりません。Maven 3.x をインストールしてください。"
    exit 1
  fi
  log_info "Maven — OK"

  # git
  if ! command -v git &>/dev/null; then
    log_error "git が見つかりません。"
    exit 1
  fi
  log_info "git — OK"

  # pmtiles CLI（任意）
  if command -v pmtiles &>/dev/null; then
    log_info "pmtiles CLI — OK（検証ステップで使用）"
  else
    log_warn "pmtiles CLI が見つかりません。検証ステップはスキップされます。"
    log_warn "インストール: https://github.com/protomaps/go-pmtiles/releases"
  fi
}

# ==============================================================================
# Protomaps Basemaps リポジトリの準備 + JAR ビルド
# ==============================================================================

clone_and_build_jar() {
  log_info "Protomaps Basemaps の準備中..."

  if [[ ! -d "${BASEMAPS_DIR}" ]]; then
    log_info "リポジトリを clone 中: ${BASEMAPS_REPO}"
    git clone "${BASEMAPS_REPO}" "${BASEMAPS_DIR}"
  fi

  cd "${BASEMAPS_DIR}"
  log_info "コミット ${BASEMAPS_COMMIT} に checkout 中..."
  git fetch origin
  git checkout "${BASEMAPS_COMMIT}"

  log_info "Maven ビルド中（tiles/）..."
  cd tiles
  mvn clean package -DskipTests

  JAR_PATH=$(find target -maxdepth 1 -name "*-with-deps.jar" 2>/dev/null | head -1)
  if [[ -z "${JAR_PATH}" ]]; then
    log_error "JARファイルが見つかりません。Maven ビルドに失敗した可能性があります。"
    exit 1
  fi

  JAR_PATH="$(cd "$(dirname "${JAR_PATH}")" && pwd)/$(basename "${JAR_PATH}")"
  log_info "JAR ビルド完了: ${JAR_PATH}"
  cd "${SCRIPT_DIR}"
}

# ==============================================================================
# 1地域のPMTilesビルド
# ==============================================================================

build_region() {
  local region="$1"
  local area
  area=$(get_area "${region}")

  if [[ -z "${area}" ]]; then
    log_error "不明な地域: ${region}"
    log_error "有効な地域: ${ALL_REGIONS}"
    exit 1
  fi

  local region_output_dir="${OUTPUT_DIR}/${region}"
  mkdir -p "${region_output_dir}"

  local output_file="${region_output_dir}/basemap.pmtiles"

  # Planetiler は --output 引数を URI として解釈する。
  # Windows (Git Bash/MSYS) の絶対パス `C:/foo/bar.pmtiles` は
  # ドライブレター `C` が URI スキームと誤認されエラーになるため、
  # `file:///` プレフィックスを付けた URI 形式に変換する。
  local output_arg="${output_file}"
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      output_arg="file:///$(cygpath -m "${output_file}")"
      ;;
  esac

  log_info "========================================="
  log_info "ビルド開始: ${region} (area=${area})"
  log_info "========================================="

  java "-Xmx${JAVA_HEAP}" -jar "${JAR_PATH}" \
    --download \
    --area="${area}" \
    --output="${output_arg}" \
    --minzoom="${ZOOM_MIN}" \
    --maxzoom="${ZOOM_MAX}" \
    --force

  log_info "ビルド完了: ${output_file}"

  local file_size
  file_size=$(du -h "${output_file}" | cut -f1)
  log_info "ファイルサイズ: ${file_size}"

  verify_pmtiles "${output_file}" "${region}"
}

# ==============================================================================
# ビルド後の検証
# ==============================================================================

verify_pmtiles() {
  local file="$1"
  local region="$2"

  if ! command -v pmtiles &>/dev/null; then
    log_warn "[${region}] pmtiles CLI がないため検証をスキップ"
    return
  fi

  log_info "[${region}] メタデータを検証中..."

  local metadata
  metadata=$(pmtiles show "${file}" 2>&1)

  echo "${metadata}"
  echo ""

  # name の確認
  if echo "${metadata}" | grep -q "name Protomaps Basemap"; then
    log_info "[${region}] name: Protomaps Basemap — OK"
  else
    log_warn "[${region}] name が 'Protomaps Basemap' と一致しません。protomaps-basemaps.json との互換性を確認してください。"
  fi

  # version の確認
  if echo "${metadata}" | grep -q "version 4\."; then
    log_info "[${region}] version: v4系 — OK"
  else
    log_warn "[${region}] version が v4系ではありません。protomaps-basemaps.json との互換性を確認してください。"
  fi

  # source-layer の確認（--metadata から vector_layers を取得）
  local full_metadata
  full_metadata=$(pmtiles show "${file}" --metadata 2>&1)

  local missing_layers=""
  for layer in ${REQUIRED_SOURCE_LAYERS}; do
    if ! echo "${full_metadata}" | grep -q "\"${layer}\""; then
      missing_layers="${missing_layers} ${layer}"
    fi
  done

  if [[ -z "${missing_layers}" ]]; then
    log_info "[${region}] source-layer: 必要な全9レイヤーが存在 — OK"
  else
    log_warn "[${region}] 以下の source-layer が見つかりません:${missing_layers}"
    log_warn "protomaps-basemaps.json との互換性に問題がある可能性があります。"
  fi
}

# ==============================================================================
# 引数パース
# ==============================================================================

parse_args() {
  TARGET_REGIONS=""
  SKIP_JAR=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --region)
        if [[ -z "${2:-}" ]]; then
          log_error "--region には地域名が必要です"
          exit 1
        fi
        TARGET_REGIONS="${TARGET_REGIONS} $2"
        shift 2
        ;;
      --skip-jar)
        SKIP_JAR=true
        shift
        ;;
      --output)
        if [[ -z "${2:-}" ]]; then
          log_error "--output にはディレクトリパスが必要です"
          exit 1
        fi
        OUTPUT_DIR="$2"
        shift 2
        ;;
      --help|-h)
        show_help
        exit 0
        ;;
      *)
        log_error "不明なオプション: $1"
        show_help
        exit 1
        ;;
    esac
  done

  # 先頭の空白を除去
  TARGET_REGIONS="${TARGET_REGIONS# }"

  # 地域未指定の場合は全地域
  if [[ -z "${TARGET_REGIONS}" ]]; then
    TARGET_REGIONS="${ALL_REGIONS}"
  fi
}

show_help() {
  cat <<'HELP'
使い方: ./basemap/build.sh [オプション]

オプション:
  --region <name>    ビルド対象地域（複数指定可）
                     有効値: hokkaido, tohoku, kanto, chubu, kansai, chugoku, shikoku, kyushu
  --skip-jar         JARビルドをスキップ（2回目以降、basemaps/tiles/target/ が存在する場合）
  --output <dir>     出力先ディレクトリ（デフォルト: basemap/output/）
  --help, -h         このヘルプを表示

例:
  ./basemap/build.sh                                # 全地域ビルド
  ./basemap/build.sh --region kanto                 # 関東のみ
  ./basemap/build.sh --region kanto --region chubu  # 複数地域
  ./basemap/build.sh --skip-jar --region kanto      # JARビルドスキップ

詳細: docs/guides/basemap-build.md
HELP
}

# ==============================================================================
# メイン
# ==============================================================================

main() {
  parse_args "$@"

  log_info "対象地域: ${TARGET_REGIONS}"

  check_prerequisites

  if [[ "${SKIP_JAR}" = true ]]; then
    JAR_PATH=$(find "${BASEMAPS_DIR}/tiles/target" -maxdepth 1 -name "*-with-deps.jar" 2>/dev/null | head -1)
    if [[ -z "${JAR_PATH}" ]]; then
      log_error "--skip-jar が指定されましたが、JARファイルが見つかりません。"
      log_error "先に --skip-jar なしで実行してください。"
      exit 1
    fi
    JAR_PATH="$(cd "$(dirname "${JAR_PATH}")" && pwd)/$(basename "${JAR_PATH}")"
    log_info "既存JAR を使用: ${JAR_PATH}"
  else
    clone_and_build_jar
  fi

  mkdir -p "${OUTPUT_DIR}"

  for region in ${TARGET_REGIONS}; do
    build_region "${region}"
  done

  log_info "========================================="
  log_info "全ビルド完了"
  log_info "出力先: ${OUTPUT_DIR}/"
  log_info ""
  log_info "配置方法:"
  log_info "  cp ${OUTPUT_DIR}/<region>/basemap.pmtiles app/public/basemap.pmtiles"
  log_info "========================================="
}

main "$@"
