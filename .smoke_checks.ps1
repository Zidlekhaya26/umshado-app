$urls = @(
  '/',
  '/marketplace',
  '/marketplace/vendor/7f5baa36-85a3-492a-8a9c-67133efb064c',
  '/messages',
  '/messages/new',
  '/auth/sign-in',
  '/auth/sign-up'
)

foreach ($u in $urls) {
  $url = "http://localhost:3000$u"
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 10
    $code = $r.StatusCode
    $body = $r.Content
    $loading = [regex]::IsMatch($body, 'Loading|Loading...', 'IgnoreCase')
    $hasSignIn = [regex]::IsMatch($body, 'Sign in|Sign\s*-?in|Sign In|Sign\s*-?Up|Sign up', 'IgnoreCase')
    $hasMessages = [regex]::IsMatch($body, 'Messages|Inbox|Threads', 'IgnoreCase')
    Write-Output "$u - $code - loading:$loading signin_or_signup:$hasSignIn messages:$hasMessages"
  } catch {
    Write-Output "$u - error: $($_.Exception.Message)"
  }
}
