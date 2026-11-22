
function Get-StatusCode {
    param($Url, $WebSession)

    try {
        $r = Invoke-WebRequest -Uri $Url -WebSession $WebSession `
            -ErrorAction Stop
        return [int]$r.StatusCode
    }
    catch {
        if ($_.Exception.Response) {
            return [int]$_.Exception.Response.StatusCode
        }
        return "ERROR"
    }
}

$tests = @(
    @{ Path="/api/session"; Expected=200 },
    @{ Path="/api/disasters"; Expected=200 },
    @{ Path="/api/shelters"; Expected=200 },
    @{ Path="/api/resources"; Expected=200 },
    @{ Path="/api/volunteers"; Expected="role-dependent" },
    @{ Path="/api/donations"; Expected="role-dependent" },
    @{ Path="/api/analytics/summary"; Expected="role-dependent" },
    @{ Path="/api/users"; Expected=403 }
)

foreach ($account in @("Coordinator", "NGO", "Volunteer")) {

    Write-Host "`nTesting $account account" -ForegroundColor Cyan

    $email = Read-Host "Enter $account email"
    $securePassword = Read-Host "Enter password" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
        $securePassword
    )

    try {
        $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        $web = New-Object Microsoft.PowerShell.Commands.WebRequestSession

        $body = @{
            email = $email
            password = $password
        } | ConvertTo-Json

        try {
            $login = Invoke-RestMethod `
                -Uri "http://127.0.0.1:5000/api/login" `
                -Method POST `
                -ContentType "application/json" `
                -Body $body `
                -WebSession $web `
                -ErrorAction Stop
        }
        catch {
            Write-Host "Login failed. Skipping this account." -ForegroundColor Red
            continue
        }

        $role = $login.user.role.ToLower()
        Write-Host "Logged in as: $role" -ForegroundColor Green

        foreach ($test in $tests) {
            $expected = $test.Expected

            if ($expected -eq "role-dependent") {
                if ($role -eq "volunteer") {
                    $expected = 403
                }
                else {
                    $expected = 200
                }
            }

            $actual = Get-StatusCode `
                "http://127.0.0.1:5000$($test.Path)" $web

            $result = if ("$actual" -eq "$expected") {
                "PASS"
            } else {
                "CHECK"
            }

            Write-Host "$($test.Path) | Expected: $expected | Actual: $actual | $result"
        }

        # Non-admin must not create Coordinator/NGO accounts.
        $blocked = Get-StatusCode "http://127.0.0.1:5000/api/users" $web
        Write-Host "Admin-only user endpoint: $blocked"

        Invoke-WebRequest `
            -Uri "http://127.0.0.1:5000/api/logout" `
            -Method POST `
            -WebSession $web `
            -ErrorAction SilentlyContinue | Out-Null

    }
    finally {
        $password = $null
        if ($bstr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }
}
