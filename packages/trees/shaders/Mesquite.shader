Shader "GolfMap/Trees/Mesquite"
{
    Properties
    {
        _MainTex("Albedo and cutout", 2D) = "white" {}
        _Color("Tint", Color) = (1,1,1,1)
        _Cutoff("Alpha cutoff", Range(0,1)) = 0.3
        [Enum(UnityEngine.Rendering.CullMode)] _Cull("Cull", Float) = 0
        _Flutter("Leaf flutter (metres)", Range(0,0.15)) = 0.06
    }
    SubShader
    {
        Tags { "Queue"="AlphaTest" "RenderType"="TransparentCutout" "DisableBatching"="LODFading" }
        Cull [_Cull]
        CGPROGRAM
        #pragma target 4.5
        #pragma surface surf StandardSpecular alphatest:_Cutoff vertex:wind addshadow
        #pragma multi_compile_instancing
        #pragma instancing_options procedural:setupInstance
        #pragma multi_compile __ GPU_FRUSTUM_ON

        sampler2D _MainTex;
        fixed4 _Color;
        float _Flutter;
        struct Input { float2 uv_MainTex; };

        // Vegetation Studio Pro supplies a transform pair and a float4 per vegetation instance.
        #ifdef UNITY_PROCEDURAL_INSTANCING_ENABLED
        struct TreeInstance { float4x4 world; float4x4 inverseWorld; float4 settings; };
        #ifdef GPU_FRUSTUM_ON
        StructuredBuffer<TreeInstance> VisibleShaderDataBuffer;
        #else
        StructuredBuffer<TreeInstance> IndirectShaderDataBuffer;
        #endif
        #endif
        void setupInstance()
        {
            #ifdef UNITY_PROCEDURAL_INSTANCING_ENABLED
            #ifdef GPU_FRUSTUM_ON
            TreeInstance tree = VisibleShaderDataBuffer[unity_InstanceID];
            #else
            TreeInstance tree = IndirectShaderDataBuffer[unity_InstanceID];
            #endif
            unity_ObjectToWorld = tree.world;
            unity_WorldToObject = tree.inverseWorld;
            #endif
        }
        void wind(inout appdata_full v)
        {
            float3 p = mul(unity_ObjectToWorld, v.vertex).xyz;
            float phase = dot(p.xz, float2(0.41,0.32)) + _Time.y * 1.6;
            float wave = sin(phase) + 0.33 * sin(phase * 2.3 + p.y);
            v.vertex.xz += float2(1,0.37) * wave * (_Flutter * v.color.a + 0.00030 * v.vertex.y * v.vertex.y);
        }
        void surf(Input IN, inout SurfaceOutputStandardSpecular o)
        {
            fixed4 rgba = tex2D(_MainTex, IN.uv_MainTex) * _Color;
            o.Albedo = rgba.rgb;
            o.Alpha = rgba.a;
            o.Smoothness = 0.0;
            o.Specular = 0.0;
        }
        ENDCG
    }
    FallBack "Transparent/Cutout/VertexLit"
}
