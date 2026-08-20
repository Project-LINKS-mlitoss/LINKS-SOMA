"""E016 が束縛する utils の経路。

E016 は utils / constants / E012 を、実行の入口によって異なる2経路から import する。
E012 だけは async_tasks/ に存在しないため、同じ try にまとめると常に失敗し、
utils まで巻き添えで別経路（async_tasks.utils）へ倒れる。IF001 は utils 側でDB接続を
張るため、倒れた側の CURSOR は None のままになり、CSV 方式の建物種別判定が
AttributeError で落ちる（issue #1966）。

束縛先が入れ替わったことに気付けるようにする。
"""

import E016


class TestE016UtilsBinding:
    """utils の束縛先。"""

    def test_utilsは単独経路で束縛される(self):
        # async_tasks/ が sys.path にあるとき（pytest・IF001 の実行時）は
        # async_tasks.utils ではなく utils が束縛される。
        assert E016.create_or_update_summarization_job_task.__module__ == "utils"

    def test_E012の関数も束縛される(self):
        assert callable(E016.normalize_address_full)
