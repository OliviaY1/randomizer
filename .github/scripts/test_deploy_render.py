"""Exercise provider success/failure responses without contacting a real service."""

import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from deploy_render import api_request, deploy

SHA = "a" * 40


class RenderDeploymentTests(unittest.TestCase):
    def test_waits_for_requested_commit(self):
        request = Mock(side_effect=[
            {"id": "dep-test"},
            {"status": "build_in_progress"},
            {"status": "live", "commit": {"id": SHA}},
        ])
        sleep = Mock()
        self.assertEqual(deploy("srv-test", "test-token", SHA, request=request, sleep=sleep), "dep-test")
        self.assertEqual(request.call_args_list[0].args[2]["commitId"], SHA)
        sleep.assert_called_once_with(15)

    def test_terminal_failures_do_not_report_success(self):
        for status in ("build_failed", "pre_deploy_failed", "update_failed", "canceled", "deactivated"):
            with self.subTest(status=status):
                request = Mock(side_effect=[{"id": "dep-test"}, {"status": status}])
                with self.assertRaisesRegex(RuntimeError, status):
                    deploy("srv-test", "test-token", SHA, request=request)

    def test_rejects_wrong_live_commit(self):
        request = Mock(side_effect=[{"id": "dep-test"}, {"status": "live", "commit": {"id": "b" * 40}}])
        with self.assertRaisesRegex(RuntimeError, "different live commit"):
            deploy("srv-test", "test-token", SHA, request=request)

    def test_rejects_missing_commit_evidence(self):
        request = Mock(side_effect=[{"id": "dep-test"}, {"status": "live"}])
        with self.assertRaisesRegex(RuntimeError, "different live commit"):
            deploy("srv-test", "test-token", SHA, request=request)

    def test_pending_deploy_times_out(self):
        request = Mock(side_effect=[{"id": "dep-test"}, {"status": "queued"}, {"status": "queued"}])
        with self.assertRaisesRegex(RuntimeError, "Timed out"):
            deploy("srv-test", "test-token", SHA, request=request, sleep=Mock(), max_polls=2)

    def test_invalid_configuration_never_calls_provider(self):
        request = Mock()
        for service, commit in (("wrong-service", SHA), ("srv-test", "main")):
            with self.assertRaises(ValueError):
                deploy(service, "test-token", commit, request=request)
        request.assert_not_called()

    def test_missing_deployment_id_fails(self):
        with self.assertRaisesRegex(RuntimeError, "deployment ID"):
            deploy("srv-test", "test-token", SHA, request=Mock(return_value={}))

    @patch("deploy_render.urlopen")
    def test_trigger_is_not_retried_or_credentials_printed(self, urlopen):
        urlopen.side_effect = HTTPError("https://api.render.com", 503, "unavailable", {}, None)
        with self.assertRaisesRegex(RuntimeError, "HTTP 503") as caught:
            api_request("services/srv-test/deploys", "test-token", {"commitId": SHA})
        self.assertNotIn("test-token", str(caught.exception))
        self.assertEqual(urlopen.call_count, 1)


if __name__ == "__main__":
    unittest.main()
