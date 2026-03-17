"""tests/unit/test_config.py — v4.7
Config environment variable loading tests.
"""
import os
import sys
import pytest

# Add parent paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


class TestConfig:
    """Test InpickConfig loads environment variables correctly."""

    def _make_config(self, **env_overrides):
        """Create a fresh config with env overrides."""
        old_env = {}
        for k, v in env_overrides.items():
            old_env[k] = os.environ.get(k)
            os.environ[k] = v

        # Re-import to get fresh config
        import importlib
        import config
        importlib.reload(config)
        cfg = config.InpickConfig()

        # Restore env
        for k, v in old_env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

        return cfg

    def test_default_seg_provider(self):
        from config import CFG
        assert CFG.seg_provider in ("yolo", "none")

    def test_default_ocr_provider(self):
        from config import CFG
        assert CFG.ocr_provider in ("paddle", "tesseract", "gcv")

    def test_storage_backend_field_exists(self):
        """v4.7 fix #8: storage_backend field must exist"""
        from config import CFG
        assert hasattr(CFG, "storage_backend")
        assert CFG.storage_backend in ("local", "r2", "supabase")

    def test_lidar_pc_fields_exist(self):
        """v4.7 fix #10: LiDAR PC runtime fields must exist"""
        from config import CFG
        assert hasattr(CFG, "pc_voxel_size_m")
        assert hasattr(CFG, "pc_wall_slice_z_min_m")
        assert hasattr(CFG, "pc_wall_slice_z_max_m")
        assert hasattr(CFG, "pc_ransac_distance_m")
        assert hasattr(CFG, "pc_grid_resolution_m")
        assert hasattr(CFG, "pc_sor_neighbors")
        assert hasattr(CFG, "pc_sor_std_ratio")
        assert hasattr(CFG, "xval_threshold_mm")

    def test_fixture_classes_list(self):
        from config import CFG
        classes = CFG.fixture_classes_list
        assert isinstance(classes, list)
        assert "toilet" in classes
        assert "sink" in classes
        assert "bathtub" in classes

    def test_abs_path_relative(self):
        from config import CFG
        path = CFG.abs_path("models/test.pt")
        assert os.path.isabs(path)

    def test_abs_path_absolute(self):
        from config import CFG
        if sys.platform == "win32":
            path = CFG.abs_path("C:\\absolute\\path.pt")
            assert path == "C:\\absolute\\path.pt"
        else:
            path = CFG.abs_path("/absolute/path.pt")
            assert path == "/absolute/path.pt"

    def test_pass1_model_abs(self):
        from config import CFG
        assert os.path.isabs(CFG.pass1_model_abs)

    def test_scale_estimation_defaults(self):
        from config import CFG
        assert 0.1 <= CFG.scale_min_mm_per_px <= 1.0
        assert 5.0 <= CFG.scale_max_mm_per_px <= 20.0
        assert 0.0 < CFG.scale_ocr_roi < 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
