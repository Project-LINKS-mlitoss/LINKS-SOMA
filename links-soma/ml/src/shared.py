"""モデル学習パイプラインの共有定数

experiments/shared.py の FEATURE_COLS を正規定義として保持する。
外部実験リポジトリとの同期元。
"""

# 学習に使用する特徴量カラム（39個・英語名）
# 同期元: experiments/shared.py:FEATURE_COLS
FEATURE_COLS = [
    # 水道系
    "water_disconnection_flag",
    "avg_water_usage",
    "max_water_usage",
    "total_water_usage",
    "change_rate_waterusage_over_last4months",
    "suido_usage_f1",
    "suido_usage_f2",
    "suido_usage_f3",
    "suido_usage_f4",
    "suido_usage_f5",
    "suido_usage_f6",
    # 水道時系列（water.py:add_water_features）
    "has_usage_data",
    "num_zero_periods",
    "min_water_usage",
    "years_since_closure",
    "usage_data_unavailable_flag",
    "usage_first_half_avg",
    "usage_second_half_avg",
    "usage_half_year_change_rate",
    "recent_usage_avg",
    # 住基系
    "juki_residence_flag",
    "household_size_juki_residence",
    "max_age_juki_residence",
    "max_age_juki_residence_isnull",
    "over_65_count_juki_residence",
    "under_15_count_juki_residence",
    "residence_duration_juki_residence",
    "num_deaths_juki_residence",
    "num_inmigrants_juki_residence",
    "num_outmigrants_relocations_juki_residence",
    "average_waterusage_person",
    # 住基イベント系
    "has_cancellation_event",
    "num_outmigrant_events",
    "years_since_last_transfer",
    "years_since_last_transfer_is_missing",
    "sole_elderly_resident",
    "death_no_replacement",
    "household_shrinkage_rate",
    # 交差・ルール系
    "composite_rule_score",
]
