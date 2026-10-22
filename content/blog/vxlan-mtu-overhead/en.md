---
title: VXLAN takes 50 bytes off every packet's MTU
summary: VXLAN adds 50 bytes of headers to every frame, 70 over IPv6. On a 1500-byte underlay, set the overlay MTU to 1450 or use jumbo frames, or large transfers stall while pings work.
---

## The problem

A new VXLAN overlay looks healthy: hosts ping each other and SSH logins work. Then a file copy, a database dump or a large HTTPS response hangs halfway, with no error on either end. Small packets get through; full-size ones do not.

## Why it happens

VXLAN tunnels Ethernet frames over UDP. Each frame from the overlay is wrapped in new headers before it crosses the underlay:

| Header | Bytes |
| --- | --- |
| Outer IPv4 | 20 |
| Outer UDP | 8 |
| VXLAN | 8 |
| Inner Ethernet (the original frame's header) | 14 |
| **Total** | **50** |

The inner Ethernet header counts because, to the underlay, it is now payload. With an IPv6 underlay the outer IP header is 40 bytes, so the total becomes 70.

An interface MTU limits the IP packet, so on a standard 1500-byte underlay the inner IP packet can be at most 1500 - 50 = 1450 bytes. If the overlay interface still says 1500, full-size packets no longer fit once encapsulated. They are dropped or fragmented, and when the ICMP messages that path MTU discovery relies on do not make it back, TCP connections stall as soon as they send full-size segments. That is why pings and short requests work while bulk transfers hang.

Whether the tunnel endpoints learn about each other by flooding or through a BGP EVPN control plane does not matter here: the data plane encapsulation, and its overhead, is the same.

## The fix

Choose one:

- **Lower the overlay MTU** to the underlay MTU minus the overhead: 1450 on a 1500-byte IPv4 underlay, 1430 over IPv6.
- **Raise the underlay MTU** with jumbo frames (any value of at least 1550, often 9000) on every link and switch in the path, so the overlay can keep 1500.

Set the overlay MTU explicitly rather than trusting a default, then test the path with the Don't Fragment bit set:

```shell
# 1500-byte underlay - 50 bytes of encapsulation:
# outer IPv4 (20) + UDP (8) + VXLAN (8) + inner Ethernet (14)
ip link add vxlan100 type vxlan id 100 dstport 4789 local 10.0.0.1 nolearning
ip link set vxlan100 mtu 1450 up

# Check the path without fragmentation: 1422 + ICMP (8) + IPv4 (20) = 1450
ping -M do -s 1422 10.200.0.2
```

If that ping succeeds, a full-size overlay packet makes it through the tunnel. With `-s 1423`, ping reports an error instead: the 1451-byte packet exceeds the interface MTU of 1450. To check the underlay itself, ping the remote tunnel endpoint with `-M do -s 1472` (1472 + 8 + 20 = 1500).

## Takeaway

Every tunnel costs headroom. When large transfers stall but pings work, compare the overlay MTU with the underlay MTU minus the encapsulation overhead before debugging anything else. Overlays built on VXLAN, such as some Kubernetes network plugins, face the same limit.
